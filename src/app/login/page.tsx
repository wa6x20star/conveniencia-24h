"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasPublicSupabaseEnv } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const configured = hasPublicSupabaseEnv();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return <div className="grid min-h-screen place-items-center bg-[#1F2A44] p-4"><main className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl"><Link href="/" className="inline-flex items-center gap-2 font-black text-[#1F2A44]"><span className="grid size-9 place-items-center rounded-xl bg-[#C6A75E]">⚡</span>Conveniência 24h</Link><p className="mt-7 text-xs font-black uppercase tracking-wider text-[#A88A45]">Equipe interna</p><h1 className="mt-1 text-3xl font-black text-[#1F2A44]">Entrar na operação</h1><p className="mt-2 text-sm text-slate-500">Clientes continuam comprando sem criar conta.</p>{!configured && <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-xs font-bold text-amber-900">Supabase ainda não está configurado na Vercel. Consulte o arquivo V4_SETUP.md.</div>}{error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-xs font-bold text-red-700">{error}</div>}<form onSubmit={submit} className="mt-6 space-y-3"><input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" required className="h-12 w-full rounded-2xl border border-[#E8DCC8] px-4 outline-none focus:border-[#C6A75E]" placeholder="E-mail"/><input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" required className="h-12 w-full rounded-2xl border border-[#E8DCC8] px-4 outline-none focus:border-[#C6A75E]" placeholder="Senha"/><button disabled={!configured || loading} className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#1F2A44] text-sm font-black text-white disabled:opacity-40">{loading ? "ENTRANDO..." : "ENTRAR"}</button></form></main></div>;
}
