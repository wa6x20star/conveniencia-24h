import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORE_SLUG, hasServerSupabaseEnv } from "@/lib/config";
import { cleanText, isUuid, sameOriginOrNoOrigin } from "@/lib/security-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 5_000_000;
const MAX_REQUEST_BYTES = 6_000_000;
const RECIFE_OFFSET = "-03:00";

type SafeProof = {
  mime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  extension: "jpg" | "png" | "webp" | "pdf";
};

function detectProof(bytes: Buffer): SafeProof | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", extension: "png" };
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  if (bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-") {
    return { mime: "application/pdf", extension: "pdf" };
  }
  return null;
}

function currentMonthStartIso() {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${key.slice(0, 7)}-01T03:00:00.000Z`;
}

function parsePaidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00${RECIFE_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function payoutCode(value: number | string | null | undefined) {
  return `REP-${String(Number(value || 0)).padStart(6, "0")}`;
}

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
    const { data: settings, error: settingsError } = await supabase.from("driver_payout_settings").select("control_started_at").eq("store_id", store.id).maybeSingle();
    if (settingsError?.code === "42P01") {
      return NextResponse.json({
        store,
        controlStartedAt: null,
        summary: { pendingAmount: 0, pendingDeliveries: 0, paidThisMonth: 0, paidBatchesThisMonth: 0 },
        drivers: [],
        payouts: [],
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if (settingsError) throw settingsError;

    const [{ data: drivers, error: driversError }, { data: batches, error: batchesError }] = await Promise.all([
      supabase.from("drivers").select("id,user_id,status,active").eq("store_id", store.id).order("created_at"),
      supabase.from("driver_payout_batches").select("id,batch_number,driver_id,total_amount,payment_method,paid_at,notes,proof_path,created_at").eq("store_id", store.id).eq("status", "paid").order("paid_at", { ascending: false }).limit(1000),
    ]);
    if (driversError) throw driversError;
    if (batchesError) throw batchesError;

    const controlStartedAt = settings?.control_started_at ?? null;
    const driverIds = (drivers ?? []).map((row: any) => row.id);
    const userIds = (drivers ?? []).map((row: any) => row.user_id);

    const [{ data: profiles, error: profilesError }, { data: eligible, error: eligibleError }] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id,full_name,phone").in("id", userIds) : Promise.resolve({ data: [], error: null } as any),
      controlStartedAt && driverIds.length
        ? supabase.from("deliveries").select("id,order_id,driver_id,driver_payout,distance_km,delivered_at").in("driver_id", driverIds).eq("status", "delivered").gte("delivered_at", controlStartedAt).gt("driver_payout", 0).order("delivered_at", { ascending: false }).limit(5000)
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (profilesError) throw profilesError;
    if (eligibleError) throw eligibleError;

    const eligibleRows = eligible ?? [];
    const orderIds = eligibleRows.map((row: any) => row.order_id);
    const recentBatches = (batches ?? []).slice(0, 60);
    const batchIds = recentBatches.map((row: any) => row.id);

    const [{ data: paidItems, error: paidItemsError }, { data: orders, error: ordersError }, { data: batchItems, error: batchItemsError }] = await Promise.all([
      controlStartedAt ? supabase.from("driver_payout_items").select("delivery_id,batch_id,amount").eq("store_id", store.id).limit(10000) : Promise.resolve({ data: [], error: null } as any),
      orderIds.length ? supabase.from("orders").select("id,order_number,neighborhood,city").eq("store_id", store.id).in("id", orderIds) : Promise.resolve({ data: [], error: null } as any),
      batchIds.length ? supabase.from("driver_payout_items").select("batch_id,delivery_id,amount").in("batch_id", batchIds) : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (paidItemsError) throw paidItemsError;
    if (ordersError) throw ordersError;
    if (batchItemsError) throw batchItemsError;

    const batchDeliveryIds = Array.from(new Set((batchItems ?? []).map((row: any) => row.delivery_id)));
    const { data: batchDeliveries, error: batchDeliveriesError } = batchDeliveryIds.length
      ? await supabase.from("deliveries").select("id,order_id,distance_km,delivered_at").in("id", batchDeliveryIds)
      : { data: [] as any[], error: null };
    if (batchDeliveriesError) throw batchDeliveriesError;

    const batchOrderIds = Array.from(new Set((batchDeliveries ?? []).map((row: any) => row.order_id)));
    const { data: batchOrders, error: batchOrdersError } = batchOrderIds.length
      ? await supabase.from("orders").select("id,order_number,neighborhood,city").eq("store_id", store.id).in("id", batchOrderIds)
      : { data: [] as any[], error: null };
    if (batchOrdersError) throw batchOrdersError;

    const profileByUser = new Map((profiles ?? []).map((row: any) => [row.id, row]));
    const orderById = new Map((orders ?? []).map((row: any) => [row.id, row]));
    const paidDeliveryIds = new Set((paidItems ?? []).map((row: any) => row.delivery_id));
    const batchDeliveryById = new Map((batchDeliveries ?? []).map((row: any) => [row.id, row]));
    const batchOrderById = new Map((batchOrders ?? []).map((row: any) => [row.id, row]));

    const monthStart = currentMonthStartIso();
    const paidThisMonth = (batches ?? []).filter((row: any) => row.paid_at >= monthStart);
    const paidByDriverMonth = new Map<string, number>();
    for (const row of paidThisMonth) paidByDriverMonth.set(row.driver_id, (paidByDriverMonth.get(row.driver_id) ?? 0) + Number(row.total_amount || 0));

    const pendingByDriver = new Map<string, any[]>();
    for (const row of eligibleRows) {
      if (paidDeliveryIds.has(row.id)) continue;
      const list = pendingByDriver.get(row.driver_id) ?? [];
      const order = orderById.get(row.order_id) as any;
      list.push({
        id: row.id,
        orderNumber: order?.order_number ?? null,
        neighborhood: order?.neighborhood ?? null,
        city: order?.city ?? null,
        deliveredAt: row.delivered_at,
        distanceKm: Number(row.distance_km || 0),
        amount: Number(row.driver_payout || 0),
      });
      pendingByDriver.set(row.driver_id, list);
    }

    const proofUrls = new Map<string, string>();
    await Promise.all(recentBatches.map(async (batch: any) => {
      if (!batch.proof_path) return;
      const { data } = await supabase.storage.from("driver-payout-proofs").createSignedUrl(batch.proof_path, 3600);
      if (data?.signedUrl) proofUrls.set(batch.id, data.signedUrl);
    }));

    const itemsByBatch = new Map<string, any[]>();
    for (const item of batchItems ?? []) {
      const delivery = batchDeliveryById.get(item.delivery_id) as any;
      const order = delivery ? batchOrderById.get(delivery.order_id) as any : null;
      const list = itemsByBatch.get(item.batch_id) ?? [];
      list.push({
        deliveryId: item.delivery_id,
        orderNumber: order?.order_number ?? null,
        neighborhood: order?.neighborhood ?? null,
        city: order?.city ?? null,
        deliveredAt: delivery?.delivered_at ?? null,
        distanceKm: Number(delivery?.distance_km || 0),
        amount: Number(item.amount || 0),
      });
      itemsByBatch.set(item.batch_id, list);
    }

    const driverRows = (drivers ?? []).map((driver: any) => {
      const pending = pendingByDriver.get(driver.id) ?? [];
      return {
        id: driver.id,
        status: driver.status,
        active: driver.active,
        profile: profileByUser.get(driver.user_id) ?? null,
        pendingAmount: pending.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0),
        pendingDeliveries: pending.length,
        paidThisMonth: paidByDriverMonth.get(driver.id) ?? 0,
        deliveries: pending,
      };
    });

    return NextResponse.json({
      store,
      controlStartedAt,
      summary: {
        pendingAmount: driverRows.reduce((sum: number, row: any) => sum + row.pendingAmount, 0),
        pendingDeliveries: driverRows.reduce((sum: number, row: any) => sum + row.pendingDeliveries, 0),
        paidThisMonth: paidThisMonth.reduce((sum: number, row: any) => sum + Number(row.total_amount || 0), 0),
        paidBatchesThisMonth: paidThisMonth.length,
      },
      drivers: driverRows,
      payouts: recentBatches.map((batch: any) => ({
        id: batch.id,
        payoutNumber: payoutCode(batch.batch_number),
        batchNumber: Number(batch.batch_number),
        driverId: batch.driver_id,
        driverName: (() => {
          const driver = (drivers ?? []).find((item: any) => item.id === batch.driver_id);
          return driver ? (profileByUser.get(driver.user_id) as any)?.full_name ?? "Entregador" : "Entregador";
        })(),
        totalAmount: Number(batch.total_amount || 0),
        paymentMethod: batch.payment_method,
        paidAt: batch.paid_at,
        notes: batch.notes,
        proofUrl: proofUrls.get(batch.id) ?? null,
        items: itemsByBatch.get(batch.id) ?? [],
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("driver_payouts_get", error);
    return NextResponse.json({ error: "payouts_unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOriginOrNoOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });

  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) return NextResponse.json({ error: "request_too_large" }, { status: 413 });

  let uploadedPath: string | null = null;
  try {
    const formData = await request.formData();
    const driverId = cleanText(formData.get("driverId"), 40);
    const paymentMethod = cleanText(formData.get("paymentMethod"), 20);
    const paidDateValue = cleanText(formData.get("paidDate"), 10);
    const notes = cleanText(formData.get("notes"), 500);
    const deliveryIdsRaw = cleanText(formData.get("deliveryIds"), 20_000);
    const paidDate = parsePaidDate(paidDateValue);

    let deliveryIds: string[] = [];
    try {
      const parsed = JSON.parse(deliveryIdsRaw);
      deliveryIds = Array.isArray(parsed) ? parsed.filter(isUuid) : [];
    } catch {
      return NextResponse.json({ error: "payout_deliveries_invalid" }, { status: 400 });
    }

    if (!isUuid(driverId) || !["pix", "cash", "transfer"].includes(paymentMethod) || !paidDate || deliveryIds.length < 1 || deliveryIds.length > 200) {
      return NextResponse.json({ error: "payout_invalid" }, { status: 400 });
    }
    if (deliveryIds.length !== new Set(deliveryIds).size) return NextResponse.json({ error: "payout_duplicate_delivery" }, { status: 400 });

    const { supabase, store } = await getStore();
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });
      const bytes = Buffer.from(await file.arrayBuffer());
      const detected = detectProof(bytes);
      if (!detected) return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
      uploadedPath = `${store.id}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${detected.extension}`;
      const { error: uploadError } = await supabase.storage.from("driver-payout-proofs").upload(uploadedPath, bytes, {
        contentType: detected.mime,
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;
    }

    const { data, error } = await supabase.rpc("create_driver_payout_v68", {
      p_store_id: store.id,
      p_driver_id: driverId,
      p_delivery_ids: deliveryIds,
      p_payment_method: paymentMethod,
      p_paid_at: paidDate.toISOString(),
      p_notes: notes || null,
      p_proof_path: uploadedPath,
      p_user_id: staff.user!.id,
    });
    if (error) {
      if (uploadedPath) await supabase.storage.from("driver-payout-proofs").remove([uploadedPath]).catch(() => undefined);
      const message = String(error.message || "payout_failed");
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ payout: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("driver_payouts_post", error);
    return NextResponse.json({ error: "payout_failed" }, { status: 500 });
  }
}
