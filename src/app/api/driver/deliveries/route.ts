import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/config";
import { cleanText, isUuid, readJsonBody, RequestBodyTooLargeError, sameOriginOrNoOrigin } from "@/lib/security-server";

export const dynamic = "force-dynamic";

const RECIFE_TIME_ZONE = "America/Recife";

async function requireDriver() {
  const staff = await getCurrentStaff(["driver"]);
  return staff.user && staff.role === "driver" ? staff : null;
}

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RECIFE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function keyToUtcDate(key: string) {
  return new Date(`${key}T03:00:00.000Z`);
}

function addDaysToKey(key: string, days: number) {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeekKey(todayKey: string) {
  const date = new Date(`${todayKey}T12:00:00.000Z`);
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return addDaysToKey(todayKey, -daysSinceMonday);
}

function startOfMonthKey(todayKey: string) {
  return `${todayKey.slice(0, 7)}-01`;
}

function summarizeDeliveries(rows: any[], minKey: string) {
  const filtered = rows.filter((row) => row.delivered_at && localDateKey(new Date(row.delivered_at)) >= minKey);
  const payout = filtered.reduce((sum, row) => sum + Number(row.driver_payout || 0), 0);
  const distance = filtered.reduce((sum, row) => sum + Number(row.distance_km || 0), 0);
  return {
    deliveries: filtered.length,
    payout,
    distanceKm: distance,
    averagePayout: filtered.length ? payout / filtered.length : 0,
  };
}

function payoutCode(value: number | string | null | undefined) {
  return `REP-${String(Number(value || 0)).padStart(6, "0")}`;
}

export async function GET() {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await requireDriver();
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const [{ data: driver, error: driverError }, { data: profile }] = await Promise.all([
      supabase.from("drivers").select("id,user_id,store_id,status,active").eq("user_id", staff.user!.id).maybeSingle(),
      supabase.from("profiles").select("full_name,phone").eq("id", staff.user!.id).maybeSingle(),
    ]);
    if (driverError || !driver || !driver.active) return NextResponse.json({ error: "driver_not_registered" }, { status: 403 });

    const todayKey = localDateKey();
    const weekKey = startOfWeekKey(todayKey);
    const monthKey = startOfMonthKey(todayKey);
    const historyFromKey = addDaysToKey(monthKey, -35);

    const [{ data: delivery, error: deliveryError }, { data: completed, error: completedError }] = await Promise.all([
      supabase
        .from("deliveries")
        .select("id,order_id,status,distance_km,customer_fee,driver_payout,assigned_at,started_at")
        .eq("driver_id", driver.id)
        .in("status", ["assigned", "started"])
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("deliveries")
        .select("id,order_id,distance_km,driver_payout,delivered_at")
        .eq("driver_id", driver.id)
        .eq("status", "delivered")
        .gte("delivered_at", keyToUtcDate(historyFromKey).toISOString())
        .order("delivered_at", { ascending: false })
        .limit(1000),
    ]);
    if (deliveryError) throw deliveryError;
    if (completedError) throw completedError;

    let order: any = null;
    let items: any[] = [];
    if (delivery) {
      const [{ data: orderData, error: orderError }, { data: itemData, error: itemError }] = await Promise.all([
        supabase.from("orders").select("id,order_number,status,payment_method,payment_status,total,delivery_fee,customer_name,customer_phone,postal_code,street,number,complement,neighborhood,city,state,address_reference,notes").eq("id", delivery.order_id).single(),
        supabase.from("order_items").select("product_name,quantity").eq("order_id", delivery.order_id).order("created_at"),
      ]);
      if (orderError) throw orderError;
      if (itemError) throw itemError;
      order = orderData;
      items = itemData ?? [];
    }

    const recentCompleted = (completed ?? []).slice(0, 12);
    const historyOrderIds = recentCompleted.map((row: any) => row.order_id);
    const { data: historyOrders, error: historyOrdersError } = historyOrderIds.length
      ? await supabase.from("orders").select("id,order_number,neighborhood,city").in("id", historyOrderIds)
      : { data: [] as any[], error: null };
    if (historyOrdersError) throw historyOrdersError;
    const historyOrderById = new Map((historyOrders ?? []).map((row: any) => [row.id, row]));

    const stats = {
      today: summarizeDeliveries(completed ?? [], todayKey),
      week: summarizeDeliveries(completed ?? [], weekKey),
      month: summarizeDeliveries(completed ?? [], monthKey),
    };

    let financial: any = {
      enabled: false,
      controlStartedAt: null,
      pendingAmount: 0,
      pendingDeliveries: 0,
      receivedThisMonth: 0,
      recentPayouts: [],
    };
    let paidDeliveryIds = new Set<string>();
    let controlStartedAt: string | null = null;

    const { data: payoutSettings, error: payoutSettingsError } = await supabase
      .from("driver_payout_settings")
      .select("control_started_at")
      .eq("store_id", driver.store_id)
      .maybeSingle();

    // 42P01 = migration V6.8 ainda não instalada. O painel continua funcionando sem o financeiro.
    if (payoutSettingsError && payoutSettingsError.code !== "42P01") throw payoutSettingsError;

    if (payoutSettings?.control_started_at) {
      controlStartedAt = payoutSettings.control_started_at;
      const [{ data: eligible, error: eligibleError }, { data: batches, error: batchesError }] = await Promise.all([
        supabase.from("deliveries").select("id,driver_payout,delivered_at").eq("driver_id", driver.id).eq("status", "delivered").gte("delivered_at", controlStartedAt).gt("driver_payout", 0).order("delivered_at", { ascending: false }).limit(5000),
        supabase.from("driver_payout_batches").select("id,batch_number,total_amount,payment_method,paid_at,proof_path").eq("driver_id", driver.id).eq("status", "paid").order("paid_at", { ascending: false }).limit(1000),
      ]);
      if (eligibleError) throw eligibleError;
      if (batchesError) throw batchesError;

      const batchIds = (batches ?? []).map((row: any) => row.id);
      const [{ data: payoutItems, error: payoutItemsError }, { data: recentBatchItems, error: recentBatchItemsError }] = await Promise.all([
        supabase.from("driver_payout_items").select("delivery_id,batch_id").eq("driver_id", driver.id).limit(10000),
        batchIds.length ? supabase.from("driver_payout_items").select("batch_id,delivery_id,amount").in("batch_id", batchIds.slice(0, 8)) : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (payoutItemsError) throw payoutItemsError;
      if (recentBatchItemsError) throw recentBatchItemsError;

      paidDeliveryIds = new Set((payoutItems ?? []).map((row: any) => row.delivery_id));
      const pendingRows = (eligible ?? []).filter((row: any) => !paidDeliveryIds.has(row.id));
      const monthStartIso = keyToUtcDate(monthKey).toISOString();
      const receivedThisMonth = (batches ?? []).filter((row: any) => row.paid_at >= monthStartIso).reduce((sum: number, row: any) => sum + Number(row.total_amount || 0), 0);
      const itemCountByBatch = new Map<string, number>();
      for (const row of recentBatchItems ?? []) itemCountByBatch.set(row.batch_id, (itemCountByBatch.get(row.batch_id) ?? 0) + 1);

      const recentPayouts = await Promise.all((batches ?? []).slice(0, 8).map(async (batch: any) => {
        let proofUrl: string | null = null;
        if (batch.proof_path) {
          const { data: signed } = await supabase.storage.from("driver-payout-proofs").createSignedUrl(batch.proof_path, 3600);
          proofUrl = signed?.signedUrl ?? null;
        }
        return {
          id: batch.id,
          payoutNumber: payoutCode(batch.batch_number),
          amount: Number(batch.total_amount || 0),
          paymentMethod: batch.payment_method,
          paidAt: batch.paid_at,
          deliveries: itemCountByBatch.get(batch.id) ?? 0,
          proofUrl,
        };
      }));

      financial = {
        enabled: true,
        controlStartedAt,
        pendingAmount: pendingRows.reduce((sum: number, row: any) => sum + Number(row.driver_payout || 0), 0),
        pendingDeliveries: pendingRows.length,
        receivedThisMonth,
        recentPayouts,
      };
    }

    const history = recentCompleted.map((row: any) => {
      const historyOrder = historyOrderById.get(row.order_id) as any;
      const beforeControl = !controlStartedAt || new Date(row.delivered_at).getTime() < new Date(controlStartedAt).getTime();
      return {
        id: row.id,
        orderNumber: historyOrder?.order_number ?? null,
        neighborhood: historyOrder?.neighborhood ?? null,
        city: historyOrder?.city ?? null,
        distanceKm: Number(row.distance_km || 0),
        payout: Number(row.driver_payout || 0),
        deliveredAt: row.delivered_at,
        payoutStatus: beforeControl ? "untracked" : paidDeliveryIds.has(row.id) ? "paid" : "pending",
      };
    });

    return NextResponse.json({
      driver: { ...driver, profile },
      delivery: delivery ? { ...delivery, order, items } : null,
      stats,
      history,
      financial,
      generatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    console.error("driver_delivery_get", error);
    return NextResponse.json({ error: "delivery_unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await requireDriver();
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOriginOrNoOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });

  try {
    const body = await readJsonBody<any>(request, 5_000);
    const action = cleanText(body.action, 20);
    const supabase = createAdminClient();
    const { data: driver } = await supabase.from("drivers").select("id,status,active").eq("user_id", staff.user!.id).maybeSingle();
    if (!driver || !driver.active) return NextResponse.json({ error: "driver_not_registered" }, { status: 403 });

    if (action === "available" || action === "offline") {
      const { count } = await supabase.from("deliveries").select("id", { count: "exact", head: true }).eq("driver_id", driver.id).in("status", ["assigned", "started"]);
      if ((count ?? 0) > 0) return NextResponse.json({ error: "active_delivery_exists" }, { status: 409 });
      const status = action === "available" ? "available" : "offline";
      const { error } = await supabase.from("drivers").update({ status, updated_at: new Date().toISOString() }).eq("id", driver.id);
      if (error) throw error;
      return NextResponse.json({ status });
    }

    if (action === "start" || action === "delivered") {
      const deliveryId = cleanText(body.deliveryId, 40);
      if (!isUuid(deliveryId)) return NextResponse.json({ error: "invalid_delivery" }, { status: 400 });
      const { data: owned } = await supabase.from("deliveries").select("id,status").eq("id", deliveryId).eq("driver_id", driver.id).maybeSingle();
      if (!owned) return NextResponse.json({ error: "delivery_not_found" }, { status: 404 });
      if (action === "start" && owned.status !== "assigned") return NextResponse.json({ error: "delivery_already_started" }, { status: 409 });
      if (action === "delivered" && owned.status !== "started") return NextResponse.json({ error: "delivery_not_started" }, { status: 409 });
      const target = action === "start" ? "started" : "delivered";
      const { data, error } = await supabase.rpc("set_delivery_status_v65", { p_delivery_id: deliveryId, p_status: target, p_user_id: staff.user!.id });
      if (error) return NextResponse.json({ error: error.message || "delivery_update_failed" }, { status: 409 });
      return NextResponse.json({ delivery: data });
    }

    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "request_too_large" }, { status: 413 });
    console.error("driver_delivery_post", error);
    return NextResponse.json({ error: "delivery_update_failed" }, { status: 500 });
  }
}
