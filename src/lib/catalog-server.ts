import { createAdminClient } from "@/lib/supabase/admin";
import { STORE_SLUG } from "@/lib/config";

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function loadCatalogFromDatabase(includeInactive = false) {
  const supabase = createAdminClient();
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,name,slug,status")
    .eq("slug", STORE_SLUG)
    .single();

  if (storeError || !store) throw new Error(storeError?.message || "Loja não encontrada");

  const { data, error } = await supabase
    .from("store_products")
    .select(`
      id,
      price,
      compare_at_price,
      badge,
      minimum_stock,
      active,
      sector,
      shelf,
      products!inner (
        public_id,
        sku,
        name,
        image_url,
        active,
        categories ( name )
      ),
      inventory ( on_hand, reserved )
    `)
    .eq("store_id", store.id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const products = (data ?? []).flatMap((row: any) => {
    const product = first<any>(row.products);
    const inventory = first<any>(row.inventory);
    const category = first<any>(product?.categories);
    if (!product) return [];
    if (!includeInactive && (row.active === false || product.active === false)) return [];

    const onHand = Number(inventory?.on_hand ?? 0);
    const reserved = Number(inventory?.reserved ?? 0);
    const base = {
      id: Number(product.public_id),
      sku: product.sku,
      name: product.name,
      category: category?.name ?? "Outros",
      price: Number(row.price ?? 0),
      oldPrice: row.compare_at_price == null ? undefined : Number(row.compare_at_price),
      stock: Math.max(0, onHand - reserved),
      minimumStock: Number(row.minimum_stock ?? 0),
      badge: row.badge ?? "",
      emoji: "🛍️",
      image: product.image_url ?? "",
      active: row.active !== false && product.active !== false,
    };

    // Campos internos só aparecem nas APIs administrativas autenticadas.
    if (!includeInactive) return [base];

    return [{
      ...base,
      onHand,
      reserved,
      storeProductId: row.id,
      location: [row.sector, row.shelf].filter(Boolean).join(" / "),
    }];
  });

  const publicStore = includeInactive ? store : { name: store.name, slug: store.slug, status: store.status };
  return { store: publicStore, products };
}
