import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/config";
import { cancellationError } from "@/lib/cancellation";
import { cleanText, isUuid, readJsonBody, RequestBodyTooLargeError, sameOriginOrNoOrigin } from "@/lib/security-server";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await getCurrentStaff(["admin"]);
  if (!staff.user || staff.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  if (!sameOriginOrNoOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  try {
    const body = await readJsonBody<{ reference?: string; confirmed?: boolean }>(request, 8_000);
    const reference = cleanText(body.reference, 300);
    if (reference.length < 3 || body.confirmed !== true) return NextResponse.json({ error: "Confirme a devolução já realizada e informe sua referência." }, { status: 400 });
    const { data, error } = await createAdminClient().rpc("complete_order_refund_v684", { p_order_id: id, p_reference: reference, p_user_id: staff.user.id });
    if (error) return NextResponse.json({ error: cancellationError(error.message) }, { status: 409 });
    return NextResponse.json({ order: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "Não foi possível registrar o estorno." }, { status: error instanceof RequestBodyTooLargeError ? 413 : 500 });
  }
}
