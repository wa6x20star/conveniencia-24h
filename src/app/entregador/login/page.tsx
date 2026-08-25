"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/client";
import { hasPublicSupabaseEnv } from "@/lib/config";

export default function DriverLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const result = await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        setError("E-mail ou senha inválidos. Confira os dados e tente novamente.");
        return;
      }

      if (result.data.user?.app_metadata?.role !== "driver") {
        await supabase.auth.signOut();
        setError("Esta conta não possui perfil de entregador. Use a conta cadastrada pela administração.");
        return;
      }

      const accessCheck = await fetch("/api/driver/deliveries", { cache: "no-store" });
      if (accessCheck.status === 403) {
        await supabase.auth.signOut();
        const body = await accessCheck.json().catch(() => ({}));
        setError(body.error === "driver_not_registered" ? "Sua conta de entregador está inativa. Fale com a administração para reativar o acesso." : "Seu acesso de entregador não está disponível no momento.");
        return;
      }
      if (!accessCheck.ok) {
        await supabase.auth.signOut();
        setError("Não foi possível validar seu acesso agora. Tente novamente em instantes.");
        return;
      }

      router.replace("/entregador");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return <div className="grid min-h-screen place-items-center bg-[#1F2A44] p-4">
    <main className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">
      <BrandLogo/>
      <p className="mt-7 text-[10px] font-black uppercase tracking-[.18em] text-[#A88A45]">Equipe de entrega</p>
      <h1 className="mt-1 text-3xl font-black text-[#1F2A44]">Entrar como entregador</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Acesso exclusivo da equipe. Você verá somente as entregas atribuídas à sua conta.</p>

      {error && <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-xs font-bold leading-5 text-red-700">{error}</div>}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="grid gap-1.5 text-xs font-black text-[#1F2A44]">
          E-mail de acesso
          <input required autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 w-full rounded-2xl border border-[#E8DCC8] px-4 text-base font-medium" placeholder="seuemail@exemplo.com"/>
        </label>

        <label className="grid gap-1.5 text-xs font-black text-[#1F2A44]">
          Senha
          <div className="relative">
            <input required autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full rounded-2xl border border-[#E8DCC8] px-4 pr-20 text-base font-medium" placeholder="Sua senha"/>
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute inset-y-1 right-1 rounded-xl px-3 text-[10px] font-black text-[#8A7040]">{showPassword ? "OCULTAR" : "MOSTRAR"}</button>
          </div>
        </label>

        <button disabled={!hasPublicSupabaseEnv() || loading} className="h-12 w-full rounded-2xl bg-[#C6A75E] text-sm font-black text-[#1F2A44] disabled:opacity-40">{loading ? "VALIDANDO ACESSO..." : "ENTRAR"}</button>
      </form>

      <div className="mt-5 rounded-2xl bg-[#F8F5EF] p-4 text-xs leading-5 text-slate-600"><strong>Primeiro acesso?</strong> O e-mail e a senha são fornecidos pela administração da Conveniência 24h.</div>
      <Link href="/" className="mt-5 block text-center text-xs font-black text-[#8A7040]">← Voltar para a loja</Link>
    </main>
  </div>;
}
