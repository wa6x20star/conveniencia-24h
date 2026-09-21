import { createClient } from "@/lib/supabase/server";
import { hasPublicSupabaseEnv, STORE_SLUG } from "@/lib/config";

export type StaffRole = "admin" | "operation" | "driver";

export async function getCurrentStaff(allowed: StaffRole[] = ["admin", "operation"]) {
  if (!hasPublicSupabaseEnv()) return { user: null, role: null as StaffRole | null, actualRole: null as StaffRole | null, configured: false };

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, role: null as StaffRole | null, actualRole: null as StaffRole | null, configured: true };

  // A função da pessoa precisa estar ligada à loja em uso. Não confiamos só
  // no papel global do token: ele seria suficiente para atravessar lojas.
  const { data: membership, error: membershipError } = await supabase
    .from("store_memberships")
    .select("role, active, stores!inner(slug)")
    .eq("user_id", user.id)
    .eq("active", true)
    .eq("stores.slug", STORE_SLUG)
    .maybeSingle();

  const actualRole = membership?.role as StaffRole | undefined;
  if (membershipError || !actualRole || !allowed.includes(actualRole)) {
    return { user, role: null as StaffRole | null, actualRole: actualRole ?? null, configured: true };
  }

  return { user, role: actualRole, actualRole, configured: true };
}
