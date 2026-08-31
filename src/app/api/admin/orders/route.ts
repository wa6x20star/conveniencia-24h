import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/config";
import { expireStaleReservationsBestEffort } from "@/lib/security-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await getCurrentStaff(["admin", "operation"]);
  if (!staff.user || !staff.role) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await expireStaleReservationsBestEffort();
    const supabase = createAdminClient();
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id,order_number,tracking_token,status,payment_method,payment_status,total,customer_name,customer_phone,neighborhood,street,number,created_at,cancellation_reason,cancelled_at,cancelled_by,cancellation_source,stock_recovered_at,refund_status,refund_amount,refunded_at,refunded_by,refund_reference")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    const pending = await supabase.from("orders").select("id,order_number,tracking_token,status,payment_method,payment_status,total,customer_name,customer_phone,neighborhood,street,number,created_at,cancellation_reason,cancelled_at,cancelled_by,cancellation_source,stock_recovered_at,refund_status,refund_amount,refunded_at,refunded_by,refund_reference").eq("refund_status", "pending").order("created_at");
    if (pending.error) throw pending.error;
    const allOrders = [...new Map([...(orders ?? []), ...(pending.data ?? [])].map(order => [order.id, order])).values()];
    const ids = allOrders.map((order) => order.id);
    let items: any[] = [];
    if (ids.length) {
      const result = await supabase.from("order_items").select("order_id,product_name,quantity").in("order_id", ids);
      if (result.error) throw result.error;
      items = result.data ?? [];
    }

    const response = allOrders.map((order) => ({
      ...order,
      items: items.filter((item) => item.order_id === order.id),
      itemCount: items.filter((item) => item.order_id === order.id).reduce((sum, item) => sum + Number(item.quantity), 0),
    }));

    return NextResponse.json({ orders: response, role: staff.role }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("admin_orders_error", error);
    return NextResponse.json({ error: "orders_unavailable" }, { status: 500 });
  }
}
