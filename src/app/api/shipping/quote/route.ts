import { NextRequest, NextResponse } from "next/server";
import { calculateShippingQuote } from "@/lib/shipping-server";
import { checkRateLimit, cleanText, digitsOnly, readJsonBody, RequestBodyTooLargeError, sameOriginOrNoOrigin } from "@/lib/security-server";
import { hasServerSupabaseEnv, DEFAULT_CITY, DEFAULT_STATE } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  if (!sameOriginOrNoOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });

  try {
    const rate = await checkRateLimit(request, "shipping-quote", 20, 600, 900);
    if (!rate.allowed) return NextResponse.json({ error: "too_many_quotes" }, { status: 429, headers: { "Retry-After": String(rate.retryAfter), "Cache-Control": "no-store" } });
    const body = await readJsonBody<any>(request, 16_000);
    const items = Array.isArray(body.items) ? body.items : [];
    const address = body.address ?? {};
    if (!items.length || items.length > 40) return NextResponse.json({ error: "invalid_items" }, { status: 400 });

    const normalizedItems: { product_id: number; quantity: number }[] = [];
    for (const raw of items) {
      const productId = Number(raw?.product_id);
      const quantity = Number(raw?.quantity);
      if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0 || quantity > 50) {
        return NextResponse.json({ error: "invalid_items" }, { status: 400 });
      }
      normalizedItems.push({ product_id: productId, quantity });
    }

    const normalizedAddress = {
      postal_code: digitsOnly(address.postal_code, 8),
      street: cleanText(address.street, 120),
      number: cleanText(address.number, 20),
      neighborhood: cleanText(address.neighborhood, 80),
      city: cleanText(address.city || DEFAULT_CITY, 80),
      state: cleanText(address.state || DEFAULT_STATE, 2).toUpperCase(),
    };

    if (normalizedAddress.postal_code.length !== 8 || normalizedAddress.street.length < 2 || !normalizedAddress.number || normalizedAddress.neighborhood.length < 2) {
      return NextResponse.json({ error: "address_incomplete" }, { status: 400 });
    }

    const quote = await calculateShippingQuote(normalizedItems, normalizedAddress);
    return NextResponse.json({ quote }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "request_too_large" }, { status: 413 });
    const message = error instanceof Error ? error.message : "quote_failed";
    if (message.includes("product_unavailable")) return NextResponse.json({ error: "product_unavailable" }, { status: 409 });
    console.error("shipping_quote", error);
    return NextResponse.json({ error: "quote_failed" }, { status: 500 });
  }
}
