import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { loadCatalogFromDatabase } from "@/lib/catalog-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv, STORE_SLUG } from "@/lib/config";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const staff = await getCurrentStaff(["admin"]);
  return staff.user && staff.role === "admin" ? staff : null;
}

export async function GET() {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const catalog = await loadCatalogFromDatabase(true);
    return NextResponse.json(catalog, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("admin_products_get", error);
    return NextResponse.json({ error: "products_unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    if (!body.name || !body.category || Number(body.price) < 0 || Number(body.stock) < 0) {
      return NextResponse.json({ error: "invalid_product" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("upsert_product_v4", {
      p_store_slug: STORE_SLUG,
      p_public_id: body.id == null ? null : Number(body.id),
      p_sku: body.sku ? String(body.sku) : null,
      p_name: String(body.name).trim(),
      p_category_name: String(body.category).trim(),
      p_image_url: body.image ? String(body.image) : null,
      p_price: Number(body.price),
      p_compare_at_price: body.oldPrice == null || body.oldPrice === "" ? null : Number(body.oldPrice),
      p_badge: String(body.badge ?? ""),
      p_minimum_stock: Math.max(0, Number(body.minimumStock ?? 0)),
      p_stock: Math.max(0, Number(body.stock)),
      p_active: body.active !== false,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ product: data }, { status: body.id == null ? 201 : 200 });
  } catch (error) {
    console.error("admin_products_post", error);
    return NextResponse.json({ error: "product_save_failed" }, { status: 500 });
  }
}
