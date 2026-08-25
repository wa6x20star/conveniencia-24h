import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/config";
import { sameOriginOrNoOrigin } from "@/lib/security-server";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 5_000_000;

type SafeImage = { mime: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" };

function detectImage(bytes: Buffer): SafeImage | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", extension: "png" };
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const staff = await getCurrentStaff(["admin"]);
  if (!staff.user || staff.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOriginOrNoOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });

  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + 500_000) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const detected = detectImage(bytes);
    if (!detected) return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });

    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${detected.extension}`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from("product-images").upload(path, bytes, {
      contentType: detected.mime,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return NextResponse.json(
      { url: data.publicUrl, path },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("product_image_upload", error);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
