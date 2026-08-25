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
      .select("id,order_number,tracking_token,status,payment_method,payment_status,total,customer_name,customer_phone,neighborhood,street,number,created_at,cancellation_reason")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    const ids = (orders ?? []).map((order) => order.id);
    let items: any[] = [];
    if (ids.length) {
      const result = await supabase.from("order_items").select("order_id,product_name,quantity").in("order_id", ids);
      if (result.error) throw result.error;
      items = result.data ?? [];
    }

    const response = (orders ?? []).map((order) => ({
      ...order,
      items: items.filter((item) => item.order_id === order.id),
      itemCount: items.filter((item) => item.order_id === order.id).reduce((sum, item) => sum + Number(item.quantity), 0),
    }));

    return NextResponse.json({ orders: response }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("admin_orders_error", error);
    return NextResponse.json({ error: "orders_unavailable" }, { status: 500 });
  }
}
