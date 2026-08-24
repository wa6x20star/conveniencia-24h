import { NextRequest, NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { loadCatalogFromDatabase } from "@/lib/catalog-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/config";

export const dynamic = "force-dynamic";

async function requireStaff() {
  const staff = await getCurrentStaff(["admin", "operation"]);
  return staff.user && staff.role ? staff : null;
}

async function requireAdmin() {
  const staff = await getCurrentStaff(["admin"]);
  return staff.user && staff.role === "admin" ? staff : null;
}

export async function GET() {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const catalog = await loadCatalogFromDatabase(true);
    const supabase = createAdminClient();
    const ids = catalog.products.map((product: any) => product.storeProductId).filter(Boolean);

    let movements: any[] = [];
    if (ids.length) {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("id,store_product_id,movement_type,quantity,order_id,user_id,reason,created_at")
        .in("store_product_id", ids)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      movements = data ?? [];
    }

    const movementProduct = new Map<string, any>();
    for (const product of catalog.products as any[]) {
      movementProduct.set(product.storeProductId, product);
    }

    const soldByProduct = new Map<string, number>();
    const soldTodayByProduct = new Map<string, number>();
    const dayFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Recife",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayKey = dayFormatter.format(new Date());

    for (const movement of movements) {
      if (movement.movement_type !== "sale") continue;
      const qty = Math.abs(Number(movement.quantity ?? 0));
      soldByProduct.set(movement.store_product_id, (soldByProduct.get(movement.store_product_id) ?? 0) + qty);
      if (movement.created_at && dayFormatter.format(new Date(movement.created_at)) === todayKey) {
        soldTodayByProduct.set(movement.store_product_id, (soldTodayByProduct.get(movement.store_product_id) ?? 0) + qty);
      }
    }

    const products = (catalog.products as any[]).map((product) => ({
      ...product,
      sold: soldByProduct.get(product.storeProductId) ?? 0,
      soldToday: soldTodayByProduct.get(product.storeProductId) ?? 0,
    }));

    const history = movements.map((movement) => {
      const product = movementProduct.get(movement.store_product_id);
      return {
        id: movement.id,
        productId: product?.id ?? null,
        productName: product?.name ?? "Produto removido",
        sku: product?.sku ?? "",
        type: movement.movement_type,
        quantity: Number(movement.quantity ?? 0),
        reason: movement.reason ?? "",
        orderId: movement.order_id,
        createdAt: movement.created_at,
      };
    });

    return NextResponse.json({
      store: catalog.store,
      role: staff.role,
      products,
      history,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("inventory_get", error);
    return NextResponse.json({ error: "inventory_unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const storeProductId = String(body.storeProductId ?? "");
    const action = String(body.action ?? "");
    const reason = String(body.reason ?? "").trim();
    const quantity = body.quantity == null || body.quantity === "" ? null : Number(body.quantity);
    const targetStock = body.targetStock == null || body.targetStock === "" ? null : Number(body.targetStock);

    if (!storeProductId || !["entry", "loss", "damage", "adjustment", "inventory"].includes(action)) {
      return NextResponse.json({ error: "invalid_movement" }, { status: 400 });
    }

    if (["entry", "loss", "damage"].includes(action) && (!Number.isInteger(quantity) || Number(quantity) <= 0)) {
      return NextResponse.json({ error: "quantity_must_be_positive" }, { status: 400 });
    }

    if (["adjustment", "inventory"].includes(action) && (!Number.isInteger(targetStock) || Number(targetStock) < 0)) {
      return NextResponse.json({ error: "target_stock_invalid" }, { status: 400 });
    }

    if (["loss", "damage", "adjustment", "inventory"].includes(action) && !reason) {
      return NextResponse.json({ error: "reason_required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("adjust_inventory_v5", {
      p_store_product_id: storeProductId,
      p_action: action,
      p_quantity: quantity,
      p_target_on_hand: targetStock,
      p_reason: reason || null,
      p_user_id: staff.user!.id,
    });

    if (error) {
      const message = error.message || "stock_update_failed";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ inventory: data });
  } catch (error) {
    console.error("inventory_post", error);
    return NextResponse.json({ error: "stock_update_failed" }, { status: 500 });
  }
}
