import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";
import { CatalogProvider } from "@/components/catalog-provider";

export const metadata: Metadata = {
  title: "Conveniência 24h | Tudo o que você precisa, a qualquer hora",
  description: "Bebidas, bomboniere, gelo, higiene e itens do dia a dia com pedido rápido e entrega 24 horas.",
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
