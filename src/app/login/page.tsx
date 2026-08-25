"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
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
    const role = result.data.user?.app_metadata?.role;
    router.push(role === "driver" ? "/entregador" : "/admin/estoque");
    router.refresh();
  }

  return <div className="grid min-h-screen bg-[#1F2A44] p-4 lg:grid-cols-2 lg:p-0">
    <section className="hidden flex-col justify-between p-10 text-white lg:flex xl:p-16">
      <BrandLogo inverted tagline />
      <div className="max-w-xl"><span className="inline-flex rounded-full border border-[#C6A75E]/40 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-[#C6A75E]">Área interna</span><h1 className="mt-5 font-display text-5xl font-black leading-tight">Controle a loja sem mexer no código.</h1><p className="mt-4 max-w-lg text-base font-medium leading-7 text-[#E8DCC8]">Pedidos, produtos, estoque, entradas, perdas, inventários e entregas ficam reunidos no painel administrativo.</p><div className="mt-8 grid grid-cols-2 gap-3 text-sm font-bold text-[#E8DCC8]"><div className="rounded-2xl border border-white/10 bg-white/5 p-4">▤ Estoque atualizado</div><div className="rounded-2xl border border-white/10 bg-white/5 p-4">▣ Vendas registradas</div><div className="rounded-2xl border border-white/10 bg-white/5 p-4">↗ Histórico de movimentos</div><div className="rounded-2xl border border-white/10 bg-white/5 p-4">✓ Acesso protegido</div></div></div>
      <p className="text-xs font-semibold text-[#E8DCC8]/70">Conveniência 24h · Painel de operação</p>
    </section>

    <section className="grid place-items-center rounded-[2rem] bg-[#F8F5EF] p-4 lg:rounded-none lg:p-8">
      <main className="w-full max-w-md rounded-[2rem] border border-[#E8DCC8] bg-white p-6 shadow-xl sm:p-8">
        <div className="lg:hidden"><BrandLogo /></div>
        <p className="mt-7 text-[10px] font-black uppercase tracking-[.18em] text-[#A88A45]">Equipe interna</p>
        <h2 className="mt-1 font-display text-3xl font-black text-[#1F2A44]">Entrar no painel</h2>
        <p className="mt-2 text-sm font-medium text-[#777066]">Seu acesso é separado da loja utilizada pelos clientes.</p>
        {!configured && <div className="mt-5 rounded-2xl border border-[#E7CF9F] bg-[#FFF6E3] p-4 text-xs font-bold text-[#795A22]">O login real será liberado depois que as variáveis do Supabase forem configuradas na Vercel.</div>}
        {error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-xs font-bold text-red-700">{error}</div>}
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="grid gap-1.5"><span className="text-xs font-black text-[#1F2A44]">E-mail</span><input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" autoComplete="email" required className="h-12 w-full rounded-2xl border border-[#E8DCC8] px-4 outline-none focus:border-[#C6A75E]" placeholder="seu@email.com"/></label>
          <label className="grid gap-1.5"><span className="text-xs font-black text-[#1F2A44]">Senha</span><input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" autoComplete="current-password" required className="h-12 w-full rounded-2xl border border-[#E8DCC8] px-4 outline-none focus:border-[#C6A75E]" placeholder="Sua senha"/></label>
          <button disabled={!configured || loading} className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#C6A75E] text-sm font-black text-[#1F2A44] transition hover:bg-[#D5B76D] disabled:opacity-40">{loading ? "ENTRANDO..." : "ENTRAR NO PAINEL"}</button>
        </form>
        <Link href="/" className="mt-5 flex justify-center text-xs font-black text-[#8A7040]">← Voltar para a loja</Link>
      </main>
    </section>
  </div>;
}
