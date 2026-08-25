import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/config";
import { checkRateLimit, isUuid } from "@/lib/security-server";

export const dynamic = "force-dynamic";

function firstNameOnly(value: unknown) {
  const first = String(value ?? "").trim().split(/\s+/)[0] || "Cliente";
  return first.slice(0, 40);
}

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });

  const { token } = await context.params;
  if (!isUuid(token)) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  try {
    const rate = await checkRateLimit(request, "track-order", 180, 600, 600);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "too_many_requests" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter), "Cache-Control": "no-store" } },
      );
    }

    const supabase = createAdminClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id,order_number,status,payment_method,payment_status,subtotal,delivery_fee,discount,total,cancellation_reason,customer_name,created_at,delivered_at")
      .eq("tracking_token", token)
      .single();

    if (error || !order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

    const [{ data: items }, { data: history }, { data: delivery }] = await Promise.all([
      supabase.from("order_items").select("id,product_name,quantity,unit_price,total_price").eq("order_id", order.id).order("created_at"),
      supabase.from("order_status_history").select("status,created_at").eq("order_id", order.id).order("created_at"),
      supabase
        .from("deliveries")
        .select("driver_id,status,assigned_at,started_at,delivered_at")
        .eq("order_id", order.id)
        .neq("status", "cancelled")
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let driverName: string | null = null;
    if (delivery?.driver_id) {
      const { data: driver } = await supabase.from("drivers").select("user_id").eq("id", delivery.driver_id).maybeSingle();
      if (driver?.user_id) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", driver.user_id).maybeSingle();
        driverName = profile?.full_name ? firstNameOnly(profile.full_name) : null;
      }
    }

    const publicOrder = {
      ...order,
      customer_name: firstNameOnly(order.customer_name),
      items: items ?? [],
      history: history ?? [],
      delivery: delivery
        ? {
            status: delivery.status,
            assigned_at: delivery.assigned_at,
            started_at: delivery.started_at,
            delivered_at: delivery.delivered_at,
            driver_name: driverName,
          }
        : null,
    };

    return NextResponse.json(
      { order: publicOrder },
      { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } },
    );
  } catch (error) {
    console.error("tracking_error", error);
    return NextResponse.json({ error: "tracking_failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
