import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CITY, DEFAULT_STATE, DELIVERY_FEE, hasServerSupabaseEnv, STORE_SLUG } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const customer = body.customer ?? {};
    const address = body.address ?? {};

    if (!items.length || !customer.name || !customer.phone || !address.postal_code || !address.street || !address.number || !address.neighborhood) {
      return NextResponse.json({ error: "invalid_order" }, { status: 400 });
    }

    const payload = {
      store_slug: STORE_SLUG,
      delivery_fee: DELIVERY_FEE,
      customer: {
        name: String(customer.name).trim(),
        phone: String(customer.phone).trim(),
      },
      address: {
        postal_code: String(address.postal_code).trim(),
        street: String(address.street).trim(),
        number: String(address.number).trim(),
        complement: String(address.complement ?? "").trim(),
        neighborhood: String(address.neighborhood).trim(),
        city: String(address.city || DEFAULT_CITY).trim(),
        state: String(address.state || DEFAULT_STATE).trim().slice(0, 2).toUpperCase(),
        reference: String(address.reference ?? "").trim(),
      },
      payment_method: body.payment_method,
      change_for: body.change_for == null || body.change_for === "" ? null : Number(body.change_for),
      notes: String(body.notes ?? "").trim(),
      items: items.map((item: any) => ({ product_id: Number(item.product_id), quantity: Number(item.quantity) })),
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("create_order_v4", { p_payload: payload });

    if (error) {
      console.error("create_order_rpc", error);
      const message = error.message || "order_failed";
      const status = message.includes("insufficient_stock") || message.includes("product_unavailable") ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ order: data }, { status: 201 });
  } catch (error) {
    console.error("create_order_error", error);
    return NextResponse.json({ error: "order_failed" }, { status: 500 });
  }
}
