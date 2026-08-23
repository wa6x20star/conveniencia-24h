import { NextResponse } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/config";
import { loadCatalogFromDatabase } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  try {
    const catalog = await loadCatalogFromDatabase(false);
    return NextResponse.json(catalog, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("catalog_error", error);
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 500 });
  }
}
