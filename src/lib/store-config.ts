const csv = (value: string | undefined, fallback: string[]) =>
  (value || fallback.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Configura a identidade de cada instalação sem duplicar o código.
 * Cada cliente recebe seus próprios valores de ambiente na implantação.
 */
const slug = process.env.NEXT_PUBLIC_STORE_SLUG || "conveniencia-24h";
const isBakery = slug === "padaria-rebeca";

export const STORE_CONFIG = {
  slug,
  isBakery,
  name: process.env.NEXT_PUBLIC_STORE_NAME || "Conveniência 24h",
  tagline: process.env.NEXT_PUBLIC_STORE_TAGLINE || "Tudo o que você precisa, a qualquer hora.",
  serviceLabel: process.env.NEXT_PUBLIC_STORE_SERVICE_LABEL || "Aberto 24 horas",
  locationLabel: process.env.NEXT_PUBLIC_STORE_LOCATION_LABEL || "Piedade, Jaboatão",
  heroTitle: process.env.NEXT_PUBLIC_STORE_HERO_TITLE || "Faltou?",
  heroHighlight: process.env.NEXT_PUBLIC_STORE_HERO_HIGHLIGHT || "A gente leva.",
  heroDescription: process.env.NEXT_PUBLIC_STORE_HERO_DESCRIPTION || "Bebidas, bomboniere, snacks e itens do dia a dia com entrega rápida",
  heroImage: process.env.NEXT_PUBLIC_STORE_HERO_IMAGE || "/hero/hero-products-integrated.png",
  heroImageAlt: process.env.NEXT_PUBLIC_STORE_HERO_IMAGE_ALT || "Sacola da Conveniência 24h com bebidas, snacks e bomboniere",
  quickTerms: csv(process.env.NEXT_PUBLIC_STORE_QUICK_TERMS, ["Água", "Gelo", "Chocolate", "Doritos", "Refrigerante"]),
  accent: process.env.NEXT_PUBLIC_STORE_ACCENT_COLOR || "#C6A75E",
  accentDark: process.env.NEXT_PUBLIC_STORE_ACCENT_DARK_COLOR || "#A88A45",
  primary: process.env.NEXT_PUBLIC_STORE_PRIMARY_COLOR || "#1F2A44",
};
