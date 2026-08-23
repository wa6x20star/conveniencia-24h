"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { products as initialProducts, type Product } from "@/lib/mock-data";

type CatalogContextValue = {
  products: Product[];
  hydrated: boolean;
  updateProduct: (id: number, patch: Partial<Product>) => void;
  addProduct: (product: Omit<Product, "id">) => void;
  resetProducts: () => void;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);
const STORAGE_KEY = "conveniencia24h.catalog.v1";

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setProducts(JSON.parse(stored));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products, hydrated]);

  const value = useMemo<CatalogContextValue>(() => ({
    products,
    hydrated,
    updateProduct(id, patch) {
      setProducts((current) =>
        current.map((product) => (product.id === id ? { ...product, ...patch } : product)),
      );
    },
    addProduct(product) {
      setProducts((current) => {
        const nextId = current.length ? Math.max(...current.map((item) => item.id)) + 1 : 1;
        return [...current, { ...product, id: nextId }];
      });
    },
    resetProducts() {
      setProducts(initialProducts);
    },
  }), [products, hydrated]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog must be used inside CatalogProvider");
  return value;
}
