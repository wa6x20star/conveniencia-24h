import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { loadCatalogFromDatabase } from "@/lib/catalog-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv, STORE_SLUG } from "@/lib/config";
import { cleanText, readJsonBody, RequestBodyTooLargeError, sameOriginOrNoOrigin } from "@/lib/security-server";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const staff = await getCurrentStaff(["admin"]);
  return staff.user && staff.role === "admin" ? staff : null;
}

function validHttpsImageUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && value.length <= 1000;
  } catch {
    return false;
  }
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
  if (!sameOriginOrNoOrigin(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });

  try {
    const body = await readJsonBody<any>(request, 16_000);
    const publicId = body.id == null || body.id === "" ? null : Number(body.id);
    const sku = cleanText(body.sku, 40).toUpperCase();
    const name = cleanText(body.name, 120);
    const category = cleanText(body.category, 60);
    const image = cleanText(body.image, 1000);
    const badge = cleanText(body.badge, 60);
    const price = Number(body.price);
    const oldPrice = body.oldPrice == null || body.oldPrice === "" ? null : Number(body.oldPrice);
    const minimumStock = Number(body.minimumStock ?? 0);
    const requestedStock = Number(body.stock ?? 0);

    if (
      (publicId != null && (!Number.isSafeInteger(publicId) || publicId <= 0)) ||
      !name || !category || name.length < 2 ||
      (sku && !/^[A-Z0-9._-]{1,40}$/.test(sku)) ||
      !Number.isFinite(price) || price < 0 || price > 100_000 ||
      (oldPrice != null && (!Number.isFinite(oldPrice) || oldPrice < 0 || oldPrice > 100_000)) ||
      !Number.isSafeInteger(minimumStock) || minimumStock < 0 || minimumStock > 1_000_000 ||
      !Number.isSafeInteger(requestedStock) || requestedStock < 0 || requestedStock > 1_000_000 ||
      !validHttpsImageUrl(image)
    ) {
      return NextResponse.json({ error: "invalid_product" }, { status: 400 });
    }

    // Em edição, o estoque não pode ser alterado pela rota de Produtos.
    // Isso preserva o histórico: saldo só muda pela API de Estoque.
    let stock = requestedStock;
    if (publicId != null) {
      const catalog = await loadCatalogFromDatabase(true);
      const current = (catalog.products as any[]).find((product) => Number(product.id) === publicId);
      if (!current) return NextResponse.json({ error: "product_not_found" }, { status: 404 });
      stock = Number(current.onHand ?? current.stock ?? 0);
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("upsert_product_v4", {
      p_store_slug: STORE_SLUG,
      p_public_id: publicId,
      p_sku: sku || null,
      p_name: name,
      p_category_name: category,
      p_image_url: image || null,
      p_price: price,
      p_compare_at_price: oldPrice,
      p_badge: badge,
      p_minimum_stock: minimumStock,
      p_stock: stock,
      p_active: body.active !== false,
    });

    if (error) {
      console.error("upsert_product_v4", error);
      const known = error.message?.includes("category_not_found") ? "category_not_found" : "product_save_failed";
      return NextResponse.json({ error: known }, { status: 409 });
    }
    return NextResponse.json({ product: data }, { status: publicId == null ? 201 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "request_too_large" }, { status: 413 });
    console.error("admin_products_post", error);
    return NextResponse.json({ error: "product_save_failed" }, { status: 500 });
  }
}
