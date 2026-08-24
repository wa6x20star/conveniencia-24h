"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo, BrandMark } from "@/components/brand-logo";
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

  return (
    <div className="brand-grid grid min-h-screen place-items-center bg-[#1F2A44] p-4">
      <div className="absolute left-8 top-8 hidden md:block"><BrandLogo inverted tagline /></div>
      <main className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-[#fffdf9] p-6 shadow-[0_32px_90px_rgba(0,0,0,.32)] md:p-7">
        <div className="absolute -right-14 -top-14 size-44 rounded-full border-[28px] border-[#C6A75E]/16" />
        <Link href="/" className="relative inline-flex md:hidden"><BrandLogo /></Link>
        <div className="relative mt-4 flex items-start justify-between gap-4 md:mt-0">
          <div>
            <p className="brand-eyebrow">Equipe interna</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-[-.035em] text-[#1F2A44]">Entrar na operação</h1>
            <p className="mt-2 text-sm leading-6 text-[#777066]">Acesso ao painel de pedidos, produtos e estoque.</p>
          </div>
          <BrandMark className="hidden size-16 shrink-0 md:block" />
        </div>
        {!configured && <div className="mt-5 rounded-2xl bg-[#FFF3D6] p-4 text-xs font-bold text-[#7A5A1D]">Supabase ainda não está configurado na Vercel. Consulte o arquivo V4_SETUP.md.</div>}
        {error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-xs font-bold text-red-700">{error}</div>}
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" required className="brand-input h-12 w-full rounded-2xl px-4" placeholder="E-mail" />
          <input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" required className="brand-input h-12 w-full rounded-2xl px-4" placeholder="Senha" />
          <button disabled={!configured || loading} className="brand-btn-primary h-12 w-full text-sm disabled:opacity-40">{loading ? "ENTRANDO..." : "ENTRAR"}</button>
        </form>
        <Link href="/" className="mt-5 block text-center text-[10px] font-extrabold uppercase tracking-wide text-[#8C8172] hover:text-[#A88A45]">Voltar para a loja</Link>
      </main>
    </div>
  );
}
