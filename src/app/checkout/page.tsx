"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StoreHeader } from "@/components/store-header";
import { useCart } from "@/components/cart-provider";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const delivery = 7;
type Payment = "pix" | "cash" | "card";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const [payment, setPayment] = useState<Payment>("pix");
  const [submitting, setSubmitting] = useState(false);
  const total = subtotal + (items.length ? delivery : 0);

  function finishOrder() {
    if (!items.length) return;
    setSubmitting(true);
    // Demonstração local. A versão Supabase substituirá este trecho por criação atômica do pedido.
    window.setTimeout(() => {
      clear();
      router.push("/pedido/demo");
    }, 350);
  }

  if (!items.length) {
    return <div className="min-h-screen bg-slate-50"><StoreHeader /><main className="mx-auto max-w-xl px-4 py-14 text-center"><div className="text-6xl">🛒</div><h1 className="mt-5 text-3xl font-black">Nenhum item para finalizar</h1><p className="mt-2 text-sm text-slate-500">Adicione produtos ao carrinho antes de abrir o checkout.</p><Link href="/" className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-xs font-black text-white">VOLTAR À LOJA</Link></main></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <StoreHeader />
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <div><p className="text-xs font-black uppercase tracking-wider text-emerald-600">Último passo</p><h1 className="mt-1 text-3xl font-black">Finalizar pedido</h1><p className="mt-2 text-sm text-slate-500">Sem cadastro obrigatório. Informe apenas o necessário para receber sua compra.</p></div>
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">1</span><h2 className="font-black">Seus dados</h2></div><div className="space-y-3"><input className="h-12 w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-emerald-400" placeholder="Nome completo" /><input className="h-12 w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-emerald-400" placeholder="WhatsApp" /></div></section>
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">2</span><h2 className="font-black">Entrega</h2></div><div className="grid gap-3 sm:grid-cols-2"><input className="h-12 rounded-2xl border border-slate-200 px-4 sm:col-span-2" placeholder="CEP" /><input className="h-12 rounded-2xl border border-slate-200 px-4 sm:col-span-2" placeholder="Rua" /><input className="h-12 rounded-2xl border border-slate-200 px-4" placeholder="Número" /><input className="h-12 rounded-2xl border border-slate-200 px-4" placeholder="Complemento" /><input className="h-12 rounded-2xl border border-slate-200 px-4 sm:col-span-2" placeholder="Bairro" /><input className="h-12 rounded-2xl border border-slate-200 px-4 sm:col-span-2" placeholder="Ponto de referência" /></div></section>
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:col-span-2"><div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">3</span><h2 className="font-black">Pagamento</h2></div><div className="grid gap-3 sm:grid-cols-3"><button onClick={() => setPayment("pix")} className={`rounded-2xl border-2 p-4 text-left ${payment === "pix" ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}><span className="text-2xl">◈</span><p className="mt-2 font-black">PIX</p><p className="text-xs text-slate-500">Rápido e confirmado online</p></button><button onClick={() => setPayment("cash")} className={`rounded-2xl border-2 p-4 text-left ${payment === "cash" ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}><span className="text-2xl">💵</span><p className="mt-2 font-black">Dinheiro</p><p className="text-xs text-slate-500">Troco informado no pedido</p></button><button onClick={() => setPayment("card")} className={`rounded-2xl border-2 p-4 text-left ${payment === "card" ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}><span className="text-2xl">💳</span><p className="mt-2 font-black">Cartão</p><p className="text-xs text-slate-500">Pagamento na entrega</p></button></div>{payment === "cash" && <input className="mt-3 h-12 w-full rounded-2xl border border-slate-200 px-4" placeholder="Troco para quanto? (opcional)" />}</section>
        </div>
        <section className="mt-5 rounded-[2rem] bg-slate-950 p-5 text-white md:flex md:items-center md:justify-between"><div><p className="text-sm text-slate-400">Total do pedido</p><p className="mt-1 text-3xl font-black">{brl.format(total)}</p><p className="mt-1 text-xs text-slate-500">Inclui {brl.format(delivery)} de entrega demonstrativa</p></div><button onClick={finishOrder} disabled={submitting} className="mt-4 h-14 w-full rounded-2xl bg-emerald-400 px-6 text-sm font-black text-slate-950 disabled:opacity-60 md:mt-0 md:w-auto">{submitting ? "CRIANDO PEDIDO..." : `FINALIZAR • ${brl.format(total)}`}</button></section>
      </main>
    </div>
  );
}
