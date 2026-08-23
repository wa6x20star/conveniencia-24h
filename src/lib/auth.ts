import { createClient } from "@/lib/supabase/server";
import { hasPublicSupabaseEnv } from "@/lib/config";

export type StaffRole = "admin" | "operation" | "driver";

export async function getCurrentStaff(allowed: StaffRole[] = ["admin", "operation"]) {
  if (!hasPublicSupabaseEnv()) return { user: null, role: null as StaffRole | null, configured: false };

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, role: null as StaffRole | null, configured: true };

  const role = user.app_metadata?.role as StaffRole | undefined;
  if (!role || !allowed.includes(role)) return { user, role: role ?? null, configured: true };

  return { user, role, configured: true };
}
