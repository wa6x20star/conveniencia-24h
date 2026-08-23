import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";
import { CatalogProvider } from "@/components/catalog-provider";

export const metadata: Metadata = {
  title: "Conveniência 24h",
  description: "Comprar rápido. Separar rápido. Entregar rápido.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <CatalogProvider>
          <CartProvider>{children}</CartProvider>
        </CatalogProvider>
      </body>
    </html>
  );
}
