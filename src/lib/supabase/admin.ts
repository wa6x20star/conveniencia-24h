import { createClient } from "@supabase/supabase-js";
import { hasServerSupabaseEnv } from "@/lib/config";

export function createAdminClient() {
  if (!hasServerSupabaseEnv()) {
    throw new Error("Supabase server environment is not configured");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
