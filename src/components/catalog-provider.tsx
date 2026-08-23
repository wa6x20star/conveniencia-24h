"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { products as initialProducts, type Product } from "@/lib/mock-data";

type CatalogContextValue = {
  products: Product[];
  loading: boolean;
  databaseConnected: boolean;
  refreshProducts: () => Promise<void>;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(true);
  const [databaseConnected, setDatabaseConnected] = useState(false);

  const refreshProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      if (!response.ok) throw new Error("Catálogo remoto indisponível");
      const payload = await response.json();
      if (Array.isArray(payload.products)) {
        setProducts(payload.products);
        setDatabaseConnected(true);
      }
    } catch {
      setDatabaseConnected(false);
      setProducts((current) => current.length ? current : initialProducts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProducts();
  }, [refreshProducts]);

  const value = useMemo(() => ({ products, loading, databaseConnected, refreshProducts }), [products, loading, databaseConnected, refreshProducts]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog must be used inside CatalogProvider");
  return value;
}
