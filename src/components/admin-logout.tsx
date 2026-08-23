"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasPublicSupabaseEnv } from "@/lib/config";

export function AdminLogout() {
  const router = useRouter();
  async function logout() {
    if (!hasPublicSupabaseEnv()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return <button onClick={logout} className="rounded-xl border border-[#E8DCC8] px-3 py-2 text-[10px] font-black text-[#1F2A44]">SAIR</button>;
}
