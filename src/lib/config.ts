export const STORE_SLUG = process.env.NEXT_PUBLIC_STORE_SLUG || "piedade";
export const STORE_WHATSAPP = (process.env.NEXT_PUBLIC_STORE_WHATSAPP || "5581995568320").replace(/\D/g, "");
export const DELIVERY_FEE = Number(process.env.NEXT_PUBLIC_DELIVERY_FEE || "7");
export const DEFAULT_CITY = process.env.NEXT_PUBLIC_DEFAULT_CITY || "Jaboatão dos Guararapes";
export const DEFAULT_STATE = process.env.NEXT_PUBLIC_DEFAULT_STATE || "PE";

export function hasPublicSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function hasServerSupabaseEnv() {
  return hasPublicSupabaseEnv() && Boolean(process.env.SUPABASE_SECRET_KEY);
}
