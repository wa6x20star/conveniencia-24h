import { createAdminClient } from "@/lib/supabase/admin";
import { DELIVERY_FEE, STORE_SLUG } from "@/lib/config";
import { cleanText, digitsOnly } from "@/lib/security-server";
import { loadCatalogFromDatabase } from "@/lib/catalog-server";

export type ShippingAddress = {
  postal_code: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type ShippingQuote = {
  available: boolean;
  subtotal: number;
  fee: number;
  distanceKm: number | null;
  driverPayout: number;
  freeDelivery: boolean;
  freeDeliveryFrom: number;
  amountToFreeDelivery: number;
  source: "free" | "distance" | "zone" | "fixed";
  message?: string;
};

type Coordinates = { lat: number; lon: number };

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundDistance(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`upstream_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function geocodeBrazilianAddress(address: Partial<ShippingAddress>): Promise<Coordinates | null> {
  const parts = [address.street, address.number, address.neighborhood, address.city, address.state, digitsOnly(address.postal_code, 8), "Brasil"]
    .map((item) => cleanText(item, 120))
    .filter(Boolean);
  if (parts.length < 3) return null;

  const base = (process.env.GEOCODING_API_BASE_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "");
  const params = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "br", q: parts.join(", ") });
  try {
    const data = await fetchJson(`${base}/search?${params.toString()}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Conveniencia24h/6.5 delivery-quote",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    const first = Array.isArray(data) ? data[0] : null;
    const lat = Number(first?.lat);
    const lon = Number(first?.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  } catch (error) {
    console.warn("geocode_unavailable", error instanceof Error ? error.message : error);
    return null;
  }
}

function haversineKm(origin: Coordinates, destination: Coordinates) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(destination.lat - origin.lat);
  const dLon = toRad(destination.lon - origin.lon);
  const lat1 = toRad(origin.lat);
  const lat2 = toRad(destination.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function routeDistanceKm(origin: Coordinates, destination: Coordinates): Promise<number> {
  const base = (process.env.ROUTING_API_BASE_URL || "https://router.project-osrm.org").replace(/\/$/, "");
  const url = `${base}/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false&alternatives=false&steps=false`;
  try {
    const data = await fetchJson(url, { headers: { "Accept": "application/json", "User-Agent": "Conveniencia24h/6.5" } });
    const meters = Number(data?.routes?.[0]?.distance);
    if (Number.isFinite(meters) && meters >= 0) return meters / 1000;
  } catch (error) {
    console.warn("routing_unavailable", error instanceof Error ? error.message : error);
  }
  // Fallback conservador quando o roteador estiver indisponível.
  return haversineKm(origin, destination) * 1.22;
}

export async function resolveOfficialSubtotal(items: { product_id: number; quantity: number }[]) {
  const catalog = await loadCatalogFromDatabase(false);
  const priceById = new Map<number, number>((catalog.products as any[]).map((product) => [Number(product.id), Number(product.price)]));
  let subtotal = 0;
  for (const item of items) {
    const price = priceById.get(item.product_id);
    if (price == null || !Number.isFinite(price)) throw new Error("product_unavailable");
    subtotal += price * item.quantity;
  }
  return roundMoney(subtotal);
}

async function getStoreDeliveryConfig() {
  const supabase = createAdminClient();
  const { data: store, error: storeError } = await supabase.from("stores").select("id").eq("slug", STORE_SLUG).single();
  if (storeError || !store) throw new Error("store_not_found");

  const [{ data: settings }, { data: rules }] = await Promise.all([
    supabase.from("delivery_settings").select("*").eq("store_id", store.id).maybeSingle(),
    supabase.from("delivery_distance_rules").select("*").eq("store_id", store.id).eq("active", true).order("sort_order"),
  ]);
  return { supabase, store, settings, rules: rules ?? [] };
}

export async function calculateShippingQuote(
  items: { product_id: number; quantity: number }[],
  address: ShippingAddress,
): Promise<ShippingQuote> {
  const subtotal = await resolveOfficialSubtotal(items);
  const { supabase, store, settings, rules } = await getStoreDeliveryConfig();
  const freeEnabled = settings?.free_delivery_enabled !== false;
  const freeDeliveryFrom = Number(settings?.free_delivery_from ?? 50);
  const amountToFreeDelivery = roundMoney(Math.max(0, freeDeliveryFrom - subtotal));

  const originLat = Number(settings?.origin_latitude);
  const originLon = Number(settings?.origin_longitude);
  const hasOrigin = Number.isFinite(originLat) && Number.isFinite(originLon);

  let distanceKm: number | null = null;
  let fee = DELIVERY_FEE;
  let driverPayout = 0;
  let source: ShippingQuote["source"] = "fixed";
  let available = true;
  let addressValidationFailed = false;

  if (hasOrigin) {
    const destination = await geocodeBrazilianAddress(address);
    if (destination) {
      distanceKm = roundDistance(await routeDistanceKm({ lat: originLat, lon: originLon }, destination));
      const maxDistance = Number(settings?.max_distance_km ?? 10);
      if (distanceKm > maxDistance) {
        available = false;
      } else {
        const rule = (rules as any[]).find((item) => distanceKm! >= Number(item.min_km) && distanceKm! <= Number(item.max_km));
        if (rule) {
          fee = Number(rule.customer_fee);
          driverPayout = Number(rule.driver_payout ?? 0);
          source = "distance";
        } else if ((rules as any[]).length) {
          available = false;
        }
      }
    } else {
      addressValidationFailed = true;
    }
  }

  // Fallback por bairro/CEP quando a geocodificação não estiver configurada/disponível.
  if (available && source === "fixed") {
    const postalCode = digitsOnly(address.postal_code, 8);
    const { data: zones } = await supabase
      .from("delivery_zones")
      .select("delivery_fee,free_delivery_from,neighborhood,postal_code_prefix")
      .eq("store_id", store.id)
      .eq("active", true);
    const normalizedNeighborhood = cleanText(address.neighborhood, 80).toLocaleLowerCase("pt-BR");
    const zone = (zones ?? []).find((item: any) => {
      const prefix = digitsOnly(item.postal_code_prefix, 8);
      const neighborhood = cleanText(item.neighborhood, 80).toLocaleLowerCase("pt-BR");
      return (prefix && postalCode.startsWith(prefix)) || (neighborhood && neighborhood === normalizedNeighborhood);
    });
    if (zone) {
      fee = Number(zone.delivery_fee ?? DELIVERY_FEE);
      source = "zone";
      addressValidationFailed = false;
    }
  }

  if (hasOrigin && source === "fixed" && addressValidationFailed) available = false;

  if (!available) {
    return {
      available: false,
      subtotal,
      fee: 0,
      distanceKm,
      driverPayout,
      freeDelivery: false,
      freeDeliveryFrom,
      amountToFreeDelivery,
      source,
      message: addressValidationFailed ? "Não foi possível validar este endereço para entrega. Confira os dados e tente novamente." : "Endereço fora da área de entrega configurada.",
    };
  }

  const freeDelivery = freeEnabled && freeDeliveryFrom > 0 && subtotal >= freeDeliveryFrom;
  if (freeDelivery) {
    fee = 0;
    source = "free";
  }

  return {
    available: true,
    subtotal,
    fee: roundMoney(fee),
    distanceKm,
    driverPayout: roundMoney(driverPayout),
    freeDelivery,
    freeDeliveryFrom,
    amountToFreeDelivery,
    source,
  };
}
