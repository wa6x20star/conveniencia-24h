import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORE_SLUG, hasServerSupabaseEnv } from "@/lib/config";
import {
  checkRateLimit,
  digitsOnly,
  readJsonBody,
  RequestBodyTooLargeError,
  sameOriginOrNoOrigin,
} from "@/lib/security-server";

export const dynamic = "force-dynamic";

function notFound() {
  return NextResponse.json(
    { error: "order_not_found" },
    { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
  );
}

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }
  if (!sameOriginOrNoOrigin(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  try {
    const rate = await checkRateLimit(request, "order-lookup", 10, 600, 900);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "too_many_requests" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter), "Cache-Control": "no-store" } },
      );
    }

    const body = await readJsonBody<any>(request, 4_000);
    const orderDigits = digitsOnly(body.order_number, 12);
    const phone = digitsOnly(body.phone, 15);
    const orderNumber = Number(orderDigits);

    if (!orderDigits || !Number.isSafeInteger(orderNumber) || orderNumber <= 0 || phone.length < 10 || phone.length > 13) {
      return notFound();
    }

    const supabase = createAdminClient();
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", STORE_SLUG)
      .single();
    if (storeError || !store) {
      return NextResponse.json({ error: "lookup_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("order_number,tracking_token")
      .eq("store_id", store.id)
      .eq("order_number", orderNumber)
      .eq("customer_phone", phone)
      .maybeSingle();

    if (error || !order?.tracking_token) return notFound();

    return NextResponse.json(
      {
        trackingToken: order.tracking_token,
        orderNumber: String(order.order_number).padStart(6, "0"),
      },
      { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } },
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "request_too_large" }, { status: 413, headers: { "Cache-Control": "no-store" } });
    }
    console.error("order_lookup", error);
    return NextResponse.json({ error: "lookup_unavailable" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
