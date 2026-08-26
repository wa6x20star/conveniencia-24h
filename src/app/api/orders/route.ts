import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CITY, DEFAULT_STATE, hasServerSupabaseEnv, STORE_SLUG } from "@/lib/config";
import { calculateShippingQuote } from "@/lib/shipping-server";
import { generateDeliveryConfirmationCode, hashDeliveryConfirmationCode } from "@/lib/delivery-confirmation-server";
import {
  checkRateLimit,
  cleanText,
  digitsOnly,
  expireStaleReservationsBestEffort,
  isUuid,
  readJsonBody,
  RequestBodyTooLargeError,
  sameOriginOrNoOrigin,
} from "@/lib/security-server";

export const dynamic = "force-dynamic";

const PAYMENT_METHODS = new Set(["pix", "cash", "card_on_delivery"]);
const MAX_ITEMS = 30;
const MAX_ITEM_QUANTITY = 20;
const MAX_TOTAL_QUANTITY = 60;

function publicOrderError(message: string) {
  if (message.includes("insufficient_stock")) return { code: "insufficient_stock", status: 409 };
  if (message.includes("product_unavailable")) return { code: "product_unavailable", status: 409 };
  if (message.includes("store_unavailable")) return { code: "store_unavailable", status: 409 };
  if (message.includes("invalid_payment_method")) return { code: "invalid_payment_method", status: 400 };
  if (message.includes("create_order_v681") || message.includes("confirmation_hash") || message.includes("delivery_confirmations")) return { code: "delivery_confirmation_setup_required", status: 503 };
  if (message.includes("security_migration") || message.includes("create_order_v65")) return { code: "security_migration_required", status: 503 };
  return { code: "order_rejected", status: 400 };
}

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  if (!sameOriginOrNoOrigin(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  try {
    const rate = await checkRateLimit(request, "create-order", 6, 600, 1800);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "too_many_orders" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter), "Cache-Control": "no-store" } },
      );
    }

    await expireStaleReservationsBestEffort();

    const body = await readJsonBody<any>(request, 24_000);
    if (cleanText(body.website, 100)) {
      return NextResponse.json({ error: "invalid_order" }, { status: 400 });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    const customer = body.customer ?? {};
    const address = body.address ?? {};

    if (!isUuid(body.client_order_key)) {
      return NextResponse.json({ error: "invalid_order_key" }, { status: 400 });
    }

    if (!items.length || items.length > MAX_ITEMS) {
      return NextResponse.json({ error: "invalid_items" }, { status: 400 });
    }

    const normalizedItems: { product_id: number; quantity: number }[] = [];
    const seen = new Set<number>();
    let totalQuantity = 0;

    for (const raw of items) {
      const productId = Number(raw?.product_id);
      const quantity = Number(raw?.quantity);
      if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_ITEM_QUANTITY || seen.has(productId)) {
        return NextResponse.json({ error: "invalid_items" }, { status: 400 });
      }
      seen.add(productId);
      totalQuantity += quantity;
      normalizedItems.push({ product_id: productId, quantity });
    }

    if (totalQuantity > MAX_TOTAL_QUANTITY) {
      return NextResponse.json({ error: "too_many_items" }, { status: 400 });
    }

    const name = cleanText(customer.name, 80);
    const phone = digitsOnly(customer.phone, 15);
    const postalCode = digitsOnly(address.postal_code, 8);
    const street = cleanText(address.street, 120);
    const number = cleanText(address.number, 20);
    const complement = cleanText(address.complement, 120);
    const neighborhood = cleanText(address.neighborhood, 80);
    const city = cleanText(address.city || DEFAULT_CITY, 80);
    const state = cleanText(address.state || DEFAULT_STATE, 2).toUpperCase();
    const reference = cleanText(address.reference, 120);
    const notes = cleanText(body.notes, 500);
    const paymentMethod = cleanText(body.payment_method, 30);

    if (
      name.length < 2 || phone.length < 10 || phone.length > 13 || postalCode.length !== 8 ||
      street.length < 2 || !number || neighborhood.length < 2 || city.length < 2 || !/^[A-Z]{2}$/.test(state) ||
      !PAYMENT_METHODS.has(paymentMethod)
    ) {
      return NextResponse.json({ error: "invalid_order" }, { status: 400 });
    }

    const changeFor = body.change_for == null || body.change_for === "" ? null : Number(body.change_for);
    if (changeFor != null && (!Number.isFinite(changeFor) || changeFor < 0 || changeFor > 100_000)) {
      return NextResponse.json({ error: "invalid_change" }, { status: 400 });
    }

    const shipping = await calculateShippingQuote(normalizedItems, {
      postal_code: postalCode,
      street,
      number,
      neighborhood,
      city,
      state,
    });
    if (!shipping.available) {
      return NextResponse.json({ error: "delivery_unavailable", quote: shipping }, { status: 422, headers: { "Cache-Control": "no-store" } });
    }

    const payload = {
      client_order_key: body.client_order_key,
      store_slug: STORE_SLUG,
      delivery_fee: shipping.fee,
      delivery_distance_km: shipping.distanceKm,
      delivery_quote_source: shipping.source,
      driver_payout: shipping.driverPayout,
      customer: { name, phone },
      address: {
        postal_code: postalCode,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        reference,
      },
      payment_method: paymentMethod,
      change_for: changeFor,
      notes,
      items: normalizedItems,
    };

    const confirmationCode = generateDeliveryConfirmationCode(String(body.client_order_key));
    const confirmationHash = hashDeliveryConfirmationCode(String(body.client_order_key), confirmationCode);

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("create_order_v681", { p_payload: payload, p_confirmation_hash: confirmationHash });

    if (error) {
      console.error("create_order_v681", error);
      const safe = publicOrderError(error.message || "order_failed");
      return NextResponse.json({ error: safe.code }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(
      { order: { ...data, confirmation_code: confirmationCode } },
      { status: 201, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "request_too_large" }, { status: 413 });
    }
    console.error("create_order_error", error);
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.includes("check_rate_limit_v64") || message.includes("create_order_v65") || message.includes("create_order_v681")) {
      return NextResponse.json({ error: "security_migration_required" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "order_failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
