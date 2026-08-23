import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await getCurrentStaff(["admin"]);
  if (!staff.user || staff.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
    if (file.size > 5_000_000) return NextResponse.json({ error: "file_too_large" }, { status: 413 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });

    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-90) || "produto.jpg";
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
    const supabase = createAdminClient();
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage.from("product-images").upload(path, bytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, path });
  } catch (error) {
    console.error("product_image_upload", error);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
