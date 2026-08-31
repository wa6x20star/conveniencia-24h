import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/config";
import { cleanText, isUuid, sameOriginOrNoOrigin } from "@/lib/security-server";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 8_000_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_REASONS = new Set(["customer_authorized_dropoff", "received_by_third_party", "code_unavailable"]);

async function requireDriver() {
  const staff = await getCurrentStaff(["driver"]);
  return staff.user && staff.role === "driver" ? staff : null;
}

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await requireDriver();
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOriginOrNoOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength && contentLength > MAX_FILE_BYTES + 100_000) return NextResponse.json({ error: "proof_too_large" }, { status: 413 });

  try {
    const form = await request.formData();
    const deliveryId = cleanText(form.get("deliveryId"), 40);
    const reason = cleanText(form.get("reason"), 50);
    const note = cleanText(form.get("note"), 300);
    const paymentReceived = String(form.get("paymentReceived") || "") === "true";
    const file = form.get("proof");

    if (!isUuid(deliveryId) || !ALLOWED_REASONS.has(reason)) return NextResponse.json({ error: "invalid_proof" }, { status: 400 });
    if (!(file instanceof File) || file.size <= 0 || file.size > MAX_FILE_BYTES || !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "invalid_proof_file" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: driver } = await supabase.from("drivers").select("id,store_id,active").eq("user_id", staff.user!.id).maybeSingle();
    if (!driver || !driver.active) return NextResponse.json({ error: "driver_not_registered" }, { status: 403 });

    const { data: delivery } = await supabase.from("deliveries").select("id,order_id,status,driver_id").eq("id", deliveryId).eq("driver_id", driver.id).maybeSingle();
    if (!delivery) return NextResponse.json({ error: "delivery_not_found" }, { status: 404 });
    if (delivery.status !== "started") return NextResponse.json({ error: "delivery_not_started" }, { status: 409 });

    const [{ data: order }, { data: confirmation, error: confirmationError }] = await Promise.all([
      supabase.from("orders").select("payment_method,payment_status").eq("id", delivery.order_id).single(),
      supabase.from("delivery_confirmations").select("id,proof_path,status").eq("order_id", delivery.order_id).maybeSingle(),
    ]);
    if (confirmationError || !confirmation) return NextResponse.json({ error: "confirmation_not_configured" }, { status: 409 });
    if (reason === "customer_authorized_dropoff" && order?.payment_status !== "paid" && ["cash", "card_on_delivery"].includes(String(order?.payment_method || ""))) {
      return NextResponse.json({ error: "dropoff_requires_prepaid" }, { status: 409 });
    }
    if (order?.payment_status !== "paid" && !paymentReceived) {
      return NextResponse.json({ error: "payment_confirmation_required" }, { status: 409 });
    }

    const path = `${driver.store_id}/${driver.id}/${deliveryId}/${randomUUID()}.${extensionFor(file.type)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("delivery-proofs").upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { data: saved, error: updateError } = await supabase.rpc("submit_delivery_proof_v684", {
      p_delivery_id: deliveryId, p_path: path, p_reason: reason, p_note: note || null,
      p_payment_received: paymentReceived, p_user_id: staff.user!.id,
    });
    if (updateError) {
      await supabase.storage.from("delivery-proofs").remove([path]).catch(() => undefined);
      return NextResponse.json({ error: "O estado da entrega mudou. Atualize a página antes de enviar novamente." }, { status: 409 });
    }
    if (saved?.previous_path && saved.previous_path !== path) {
      await supabase.storage.from("delivery-proofs").remove([saved.previous_path]).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, status: "proof_pending" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("delivery_proof_submit", error);
    return NextResponse.json({ error: "proof_upload_failed" }, { status: 500 });
  }
}
