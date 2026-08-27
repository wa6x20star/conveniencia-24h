import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORE_SLUG, hasServerSupabaseEnv, DEFAULT_CITY, DEFAULT_STATE } from "@/lib/config";
import { cleanText, digitsOnly, readJsonBody, RequestBodyTooLargeError, sameOriginOrNoOrigin } from "@/lib/security-server";
import { geocodeBrazilianAddress, resolveBrazilianShippingAddress } from "@/lib/shipping-server";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const staff = await getCurrentStaff(["admin"]);
  return staff.user && staff.role === "admin" ? staff : null;
}

async function getStore() {
  const supabase = createAdminClient();
  const { data: store, error } = await supabase.from("stores").select("id,name,slug").eq("slug", STORE_SLUG).single();
  if (error || !store) throw error || new Error("store_not_found");
  return { supabase, store };
}

export async function GET() {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { supabase, store } = await getStore();
    const [{ data: settings }, { data: rules }] = await Promise.all([
      supabase.from("delivery_settings").select("*").eq("store_id", store.id).maybeSingle(),
      supabase.from("delivery_distance_rules").select("*").eq("store_id", store.id).order("sort_order"),
    ]);
    return NextResponse.json({ store, settings, rules: rules ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("delivery_settings_get", error);
    return NextResponse.json({ error: "settings_unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOriginOrNoOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });

  try {
    const body = await readJsonBody<any>(request, 20_000);
    const origin = body.origin ?? {};
    const postalCode = digitsOnly(origin.postal_code, 8);
    const street = cleanText(origin.street, 120);
    const number = cleanText(origin.number, 20);
    const neighborhood = cleanText(origin.neighborhood, 80);
    const city = cleanText(origin.city || DEFAULT_CITY, 80);
    const state = cleanText(origin.state || DEFAULT_STATE, 2).toUpperCase();
    const freeDeliveryFrom = Number(body.freeDeliveryFrom ?? 50);
    const maxDistanceKm = Number(body.maxDistanceKm ?? 10);
    const rules = Array.isArray(body.rules) ? body.rules : [];

    if (postalCode.length !== 8 || street.length < 2 || !number || neighborhood.length < 2 || !/^[A-Z]{2}$/.test(state)) {
      return NextResponse.json({ error: "origin_invalid" }, { status: 400 });
    }
    if (!Number.isFinite(freeDeliveryFrom) || freeDeliveryFrom < 0 || freeDeliveryFrom > 100000 || !Number.isFinite(maxDistanceKm) || maxDistanceKm <= 0 || maxDistanceKm > 100) {
      return NextResponse.json({ error: "settings_invalid" }, { status: 400 });
    }
    if (!rules.length || rules.length > 20) return NextResponse.json({ error: "rules_invalid" }, { status: 400 });

    const normalizedRules = rules.map((rule: any, index: number) => ({
      min_km: Number(rule.minKm),
      max_km: Number(rule.maxKm),
      customer_fee: Number(rule.customerFee),
      driver_payout: Number(rule.driverPayout ?? 0),
      sort_order: (index + 1) * 10,
      active: rule.active !== false,
    }));
    if (normalizedRules.some((rule: any) => !Number.isFinite(rule.min_km) || !Number.isFinite(rule.max_km) || rule.min_km < 0 || rule.max_km <= rule.min_km || !Number.isFinite(rule.customer_fee) || rule.customer_fee < 0 || !Number.isFinite(rule.driver_payout) || rule.driver_payout < 0)) {
      return NextResponse.json({ error: "rules_invalid" }, { status: 400 });
    }

    const resolvedOrigin = await resolveBrazilianShippingAddress({ postal_code: postalCode, street, number, neighborhood, city, state });
    const coordinates = await geocodeBrazilianAddress(resolvedOrigin.address, resolvedOrigin.postalLookup.coordinates);
    if (!coordinates) return NextResponse.json({ error: "origin_not_found" }, { status: 422 });

    const canonicalOrigin = resolvedOrigin.address;
    const { supabase, store } = await getStore();
    const { data: saved, error: saveError } = await supabase.rpc("save_delivery_settings_v65", {
      p_store_id: store.id,
      p_payload: {
        origin_postal_code: canonicalOrigin.postal_code,
        origin_street: canonicalOrigin.street,
        origin_number: canonicalOrigin.number,
        origin_neighborhood: canonicalOrigin.neighborhood,
        origin_city: canonicalOrigin.city,
        origin_state: canonicalOrigin.state,
        origin_latitude: coordinates.lat,
        origin_longitude: coordinates.lon,
        free_delivery_enabled: body.freeDeliveryEnabled !== false,
        free_delivery_from: freeDeliveryFrom,
        max_distance_km: maxDistanceKm,
        rules: normalizedRules,
      },
    });
    if (saveError) throw saveError;

    return NextResponse.json({ ok: true, coordinates, saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "request_too_large" }, { status: 413 });
    console.error("delivery_settings_post", error);
    return NextResponse.json({ error: "settings_save_failed" }, { status: 500 });
  }
}
