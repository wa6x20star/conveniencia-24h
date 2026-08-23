import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/config";

const allowed = new Set(["received", "picking", "ready", "out_for_delivery", "delivered", "cancelled"]);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await getCurrentStaff(["admin", "operation"]);
  if (!staff.user || !staff.role) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();
  const status = String(body.status || "");
  if (!allowed.has(status)) return NextResponse.json({ error: "invalid_status" }, { status: 400 });

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("set_order_status_v4", {
      p_order_id: id,
      p_status: status,
      p_note: body.note ? String(body.note) : null,
      p_user_id: staff.user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ order: data });
  } catch (error) {
    console.error("status_update_error", error);
    return NextResponse.json({ error: "status_update_failed" }, { status: 500 });
  }
}
