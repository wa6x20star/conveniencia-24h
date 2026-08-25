import { createClient } from "@/lib/supabase/server";
import { hasPublicSupabaseEnv } from "@/lib/config";

export type StaffRole = "admin" | "operation" | "driver";

export async function getCurrentStaff(allowed: StaffRole[] = ["admin", "operation"]) {
  if (!hasPublicSupabaseEnv()) return { user: null, role: null as StaffRole | null, actualRole: null as StaffRole | null, configured: false };

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, role: null as StaffRole | null, actualRole: null as StaffRole | null, configured: true };

  const actualRole = user.app_metadata?.role as StaffRole | undefined;
  if (!actualRole || !allowed.includes(actualRole)) {
    return { user, role: null as StaffRole | null, actualRole: actualRole ?? null, configured: true };
  }

  return { user, role: actualRole, actualRole, configured: true };
}
