import { cancellationError } from "@/lib/cancellation";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/config";
import { cleanText, isUuid, readJsonBody, RequestBodyTooLargeError, sameOriginOrNoOrigin } from "@/lib/security-server";

const allowed = new Set(["received", "picking", "ready", "cancelled"]);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await getCurrentStaff(["admin", "operation"]);
  if (!staff.user || !staff.role) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!sameOriginOrNoOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });

  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  try {
    const body = await readJsonBody<{ status?: unknown; note?: unknown; stockReturned?: boolean }>(request, 8_000);
    const status = cleanText(body.status, 30);
    const note = cleanText(body.note, 300);
    if (!allowed.has(status)) return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    const supabase = createAdminClient();
    if (status === "cancelled" && note.length < 3) return NextResponse.json({ error: "cancellation_reason_required" }, { status: 400 });
    const { data, error } = status === "cancelled" ? await supabase.rpc("cancel_order_v684", {
      p_order_id: id, p_reason: note, p_user_id: staff.user.id,
      p_stock_returned: body.stockReturned === true, p_source: "staff",
    }) : await supabase.rpc("set_order_status_v64", {
      p_order_id: id,
      p_status: status,
      p_note: note || null,
      p_user_id: staff.user.id,
    });
    if (error) return NextResponse.json({ error: cancellationError(error.message) }, { status: 409 });
    return NextResponse.json({ order: data });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "request_too_large" }, { status: 413 });
    console.error("status_update_error", error);
    return NextResponse.json({ error: "status_update_failed" }, { status: 500 });
  }
}
