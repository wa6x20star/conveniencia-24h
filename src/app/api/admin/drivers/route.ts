import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORE_SLUG, hasServerSupabaseEnv } from "@/lib/config";
import { cleanText, isUuid, readJsonBody, RequestBodyTooLargeError, sameOriginOrNoOrigin } from "@/lib/security-server";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const staff = await getCurrentStaff(["admin"]);
  return staff.user && staff.role === "admin" ? staff : null;
}

async function getStoreDriver(supabase: ReturnType<typeof createAdminClient>, driverId: string) {
  const { data: store, error: storeError } = await supabase.from("stores").select("id").eq("slug", STORE_SLUG).single();
  if (storeError || !store) throw storeError || new Error("store_not_found");
  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id,user_id,store_id,status,active")
    .eq("id", driverId)
    .eq("store_id", store.id)
    .maybeSingle();
  if (driverError) throw driverError;
  return { store, driver };
}

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOriginOrNoOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });

  try {
    const body = await readJsonBody<any>(request, 10_000);
    const action = cleanText(body.action, 24);
    const supabase = createAdminClient();

    if (action === "update") {
      const driverId = cleanText(body.driverId, 40);
      const name = cleanText(body.name, 100);
      const phone = cleanText(body.phone, 30);
      if (!isUuid(driverId) || name.length < 2) return NextResponse.json({ error: "invalid_driver" }, { status: 400 });

      const { driver } = await getStoreDriver(supabase, driverId);
      if (!driver) return NextResponse.json({ error: "driver_not_found" }, { status: 404 });

      const now = new Date().toISOString();
      const { error: profileError } = await supabase.from("profiles").update({ full_name: name, phone: phone || null }).eq("id", driver.user_id);
      if (profileError) throw profileError;
      const { error: touchError } = await supabase.from("drivers").update({ updated_at: now }).eq("id", driver.id);
      if (touchError) throw touchError;

      const { error: authError } = await supabase.auth.admin.updateUserById(driver.user_id, { user_metadata: { full_name: name } });
      if (authError) console.error("driver_auth_metadata_update", authError);

      return NextResponse.json({ ok: true, driverId, profile: { full_name: name, phone } }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "set_active") {
      const driverId = cleanText(body.driverId, 40);
      const active = body.active === true;
      if (!isUuid(driverId) || typeof body.active !== "boolean") return NextResponse.json({ error: "invalid_driver" }, { status: 400 });

      const { driver } = await getStoreDriver(supabase, driverId);
      if (!driver) return NextResponse.json({ error: "driver_not_found" }, { status: 404 });

      if (!active) {
        const { count, error: countError } = await supabase
          .from("deliveries")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", driver.id)
          .in("status", ["assigned", "started"]);
        if (countError) throw countError;
        if ((count ?? 0) > 0) return NextResponse.json({ error: "active_delivery_exists" }, { status: 409 });
      }

      const now = new Date().toISOString();
      const { error: driverError } = await supabase
        .from("drivers")
        .update({ active, status: "offline", updated_at: now })
        .eq("id", driver.id);
      if (driverError) throw driverError;
      const { error: profileError } = await supabase.from("profiles").update({ active }).eq("id", driver.user_id);
      if (profileError) throw profileError;

      return NextResponse.json({ ok: true, driverId, active, status: "offline" }, { headers: { "Cache-Control": "no-store" } });
    }

    const name = cleanText(body.name, 100);
    const email = cleanText(body.email, 160).toLowerCase();
    const phone = cleanText(body.phone, 30);
    const password = String(body.password ?? "");
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "invalid_driver" }, { status: 400 });
    }

    const { data: store, error: storeError } = await supabase.from("stores").select("id").eq("slug", STORE_SLUG).single();
    if (storeError || !store) throw storeError || new Error("store_not_found");

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "driver" },
      user_metadata: { full_name: name },
    });
    if (userError || !userData.user) {
      const message = userError?.message?.toLowerCase().includes("already") ? "driver_email_exists" : "driver_create_failed";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const userId = userData.user.id;
    const { error: profileError } = await supabase.from("profiles").upsert({ id: userId, full_name: name, phone: phone || null, active: true });
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .insert({ user_id: userId, store_id: store.id, status: "available", active: true })
      .select("id,user_id,status,active,created_at,updated_at")
      .single();

    if (profileError || driverError) {
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
      return NextResponse.json({ error: "driver_create_failed" }, { status: 409 });
    }

    return NextResponse.json({ driver: { ...driver, profile: { id: userId, full_name: name, phone } } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "request_too_large" }, { status: 413 });
    console.error("driver_admin", error);
    return NextResponse.json({ error: "driver_action_failed" }, { status: 500 });
  }
}
