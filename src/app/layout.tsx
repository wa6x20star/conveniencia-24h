import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";
import { CatalogProvider } from "@/components/catalog-provider";
import { STORE_CONFIG } from "@/lib/store-config";

export const metadata: Metadata = {
  title: `${STORE_CONFIG.name} | ${STORE_CONFIG.tagline}`,
  description: `${STORE_CONFIG.heroDescription} em ${process.env.NEXT_PUBLIC_DEFAULT_CITY || "sua região"}.`,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body style={{ "--store-primary": STORE_CONFIG.primary, "--store-accent": STORE_CONFIG.accent, "--store-accent-dark": STORE_CONFIG.accentDark } as React.CSSProperties}>
        <CatalogProvider>
          <CartProvider>{children}</CartProvider>
        </CatalogProvider>
      </body>
    </html>
  );
}
