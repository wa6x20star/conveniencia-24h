import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });

  const { token } = await context.params;
  try {
    const supabase = createAdminClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id,order_number,tracking_token,status,payment_method,payment_status,subtotal,delivery_fee,discount,total,notes,cancellation_reason,customer_name,customer_phone,postal_code,street,number,complement,neighborhood,city,state,address_reference,created_at,delivered_at")
      .eq("tracking_token", token)
      .single();

    if (error || !order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

    const [{ data: items }, { data: history }] = await Promise.all([
      supabase.from("order_items").select("id,product_name,quantity,unit_price,total_price").eq("order_id", order.id).order("created_at"),
      supabase.from("order_status_history").select("status,note,created_at").eq("order_id", order.id).order("created_at"),
    ]);

    return NextResponse.json({ order: { ...order, items: items ?? [], history: history ?? [] } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("tracking_error", error);
    return NextResponse.json({ error: "tracking_failed" }, { status: 500 });
  }
}
