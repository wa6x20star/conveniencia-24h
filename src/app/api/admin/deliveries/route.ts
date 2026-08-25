import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORE_SLUG, hasServerSupabaseEnv } from "@/lib/config";
import { cleanText, isUuid, readJsonBody, RequestBodyTooLargeError, sameOriginOrNoOrigin } from "@/lib/security-server";

export const dynamic = "force-dynamic";

async function requireStaff() {
  const staff = await getCurrentStaff(["admin", "operation"]);
  return staff.user && staff.role ? staff : null;
}

function currentMonthStartIso() {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${key.slice(0, 7)}-01T03:00:00.000Z`;
}

export async function GET() {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { data: store, error: storeError } = await supabase.from("stores").select("id,name,slug").eq("slug", STORE_SLUG).single();
    if (storeError || !store) throw storeError || new Error("store_not_found");

    const [{ data: drivers, error: driversError }, { data: readyOrders, error: ordersError }, { data: deliveries, error: deliveriesError }] = await Promise.all([
      supabase.from("drivers").select("id,user_id,status,active,created_at").eq("store_id", store.id).eq("active", true).order("created_at"),
      supabase.from("orders").select("id,order_number,status,payment_method,payment_status,total,delivery_fee,delivery_distance_km,driver_payout,customer_name,neighborhood,city,created_at").eq("store_id", store.id).eq("status", "ready").order("created_at"),
      supabase.from("deliveries").select("id,order_id,driver_id,status,distance_km,customer_fee,driver_payout,assigned_at,started_at,delivered_at").in("status", ["assigned", "started"]).order("assigned_at", { ascending: false }),
    ]);
    if (driversError) throw driversError;
    if (ordersError) throw ordersError;
    if (deliveriesError) throw deliveriesError;

    const driverUserIds = (drivers ?? []).map((item: any) => item.user_id);
    const { data: profiles } = driverUserIds.length
      ? await supabase.from("profiles").select("id,full_name,phone").in("id", driverUserIds)
      : { data: [] as any[] };
    const profileById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));

    const activeOrderIds = new Set((deliveries ?? []).filter((delivery: any) => delivery.status !== "cancelled").map((delivery: any) => delivery.order_id));
    const pending = (readyOrders ?? []).filter((order: any) => !activeOrderIds.has(order.id));

    const deliveryOrderIds = (deliveries ?? []).map((delivery: any) => delivery.order_id);
    const { data: deliveryOrders } = deliveryOrderIds.length
      ? await supabase.from("orders").select("id,order_number,total,customer_name,neighborhood,city,status,payment_method,payment_status").in("id", deliveryOrderIds).eq("store_id", store.id)
      : { data: [] as any[] };
    const orderById = new Map((deliveryOrders ?? []).map((order: any) => [order.id, order]));

    const driverIds = (drivers ?? []).map((driver: any) => driver.id);
    const { data: completedThisMonth, error: completedError } = driverIds.length
      ? await supabase
          .from("deliveries")
          .select("driver_id,driver_payout,distance_km,delivered_at")
          .in("driver_id", driverIds)
          .eq("status", "delivered")
          .gte("delivered_at", currentMonthStartIso())
          .order("delivered_at", { ascending: false })
      : { data: [] as any[], error: null };
    if (completedError) throw completedError;

    const statsByDriver = new Map<string, { deliveries: number; payout: number; distanceKm: number }>();
    for (const row of completedThisMonth ?? []) {
      const current = statsByDriver.get(row.driver_id) ?? { deliveries: 0, payout: 0, distanceKm: 0 };
      current.deliveries += 1;
      current.payout += Number(row.driver_payout || 0);
      current.distanceKm += Number(row.distance_km || 0);
      statsByDriver.set(row.driver_id, current);
    }

    return NextResponse.json({
      store,
      drivers: (drivers ?? []).map((driver: any) => ({
        ...driver,
        profile: profileById.get(driver.user_id) ?? null,
        monthStats: statsByDriver.get(driver.id) ?? { deliveries: 0, payout: 0, distanceKm: 0 },
      })),
      pendingOrders: pending,
      activeDeliveries: (deliveries ?? []).filter((delivery: any) => orderById.has(delivery.order_id)).map((delivery: any) => ({ ...delivery, order: orderById.get(delivery.order_id) ?? null })),
      role: staff.role,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("deliveries_admin_get", error);
    return NextResponse.json({ error: "deliveries_unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOriginOrNoOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });

  try {
    const body = await readJsonBody<any>(request, 8_000);
    const action = cleanText(body.action, 20);
    const supabase = createAdminClient();

    if (action === "assign") {
      const orderId = cleanText(body.orderId, 40);
      const driverId = cleanText(body.driverId, 40);
      if (!isUuid(orderId) || !isUuid(driverId)) return NextResponse.json({ error: "invalid_assignment" }, { status: 400 });
      const { data, error } = await supabase.rpc("assign_delivery_v65", { p_order_id: orderId, p_driver_id: driverId, p_user_id: staff.user!.id });
      if (error) return NextResponse.json({ error: error.message || "assignment_failed" }, { status: 409 });
      return NextResponse.json({ delivery: data }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "unassign") {
      const deliveryId = cleanText(body.deliveryId, 40);
      if (!isUuid(deliveryId)) return NextResponse.json({ error: "invalid_delivery" }, { status: 400 });
      const { data, error } = await supabase.rpc("set_delivery_status_v65", { p_delivery_id: deliveryId, p_status: "cancelled", p_user_id: staff.user!.id });
      if (error) return NextResponse.json({ error: error.message || "unassign_failed" }, { status: 409 });
      return NextResponse.json({ delivery: data }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "request_too_large" }, { status: 413 });
    console.error("deliveries_admin_post", error);
    return NextResponse.json({ error: "delivery_action_failed" }, { status: 500 });
  }
}
