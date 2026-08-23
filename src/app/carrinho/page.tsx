"use client";

import Link from "next/link";
import { StoreHeader } from "@/components/store-header";
import { useCart } from "@/components/cart-provider";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const delivery = 7;

export default function CartPage() {
  const { items, subtotal, increment, decrement, removeItem } = useCart();
  return (
    <div className="min-h-screen bg-[#F8F5EF]">
      <StoreHeader />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[1fr_360px] md:px-6 md:py-10">
        <section>
          <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">Seu pedido</p><h1 className="mt-1 text-3xl font-black">Carrinho</h1></div><Link href="/" className="text-sm font-bold text-slate-500">Continuar comprando</Link></div>
          {items.length === 0 ? <div className="mt-6 rounded-[2rem] border border-dashed border-[#D8C7AC] bg-white p-10 text-center"><div className="text-5xl">🛒</div><h2 className="mt-4 text-xl font-black">Seu carrinho está vazio</h2><p className="mt-2 text-sm text-slate-500">Adicione alguns produtos para continuar.</p><Link href="/" className="mt-5 inline-flex rounded-2xl bg-[#1F2A44] px-4 py-3 text-xs font-black text-white">VER PRODUTOS</Link></div> : <div className="mt-6 space-y-3">{items.map((item) => (
            <article key={item.id} className="flex items-center gap-4 rounded-3xl border border-[#E8DCC8] bg-white p-4 shadow-sm">
              <div className="product-photo grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#E8DCC8] text-3xl">{item.image ? <img src={item.image} alt="" className="h-full w-full object-contain p-1.5" /> : item.emoji}</div>
              <div className="min-w-0 flex-1"><h2 className="truncate font-bold">{item.name}</h2><p className="mt-1 text-sm font-black">{brl.format(item.price)}</p><button onClick={() => removeItem(item.id)} className="mt-1 text-[11px] font-bold text-rose-500">Remover</button></div>
              <div className="flex items-center gap-3 rounded-2xl bg-[#F4ECDF] p-1"><button onClick={() => decrement(item.id)} className="grid size-8 place-items-center rounded-xl bg-white font-black">−</button><span className="min-w-4 text-center text-sm font-black">{item.qty}</span><button onClick={() => increment(item.id)} className="grid size-8 place-items-center rounded-xl bg-[#1F2A44] font-black text-white">+</button></div>
            </article>
          ))}</div>}
          {items.length > 0 && <div className="mt-5 rounded-3xl border border-[#E8DCC8] bg-[#F7F2E9] p-4 text-sm font-semibold text-[#1F2A44]">💡 Faltam <strong>{brl.format(Math.max(0, 60 - subtotal))}</strong> para atingir R$ 60,00 em produtos.</div>}
        </section>
        <aside className="h-fit rounded-[2rem] border border-[#E8DCC8] bg-white p-5 shadow-sm md:sticky md:top-24">
          <h2 className="text-lg font-black">Resumo</h2>
          <div className="mt-5 space-y-3 text-sm"><div className="flex justify-between text-slate-500"><span>Produtos</span><strong className="text-[#1F2A44]">{brl.format(subtotal)}</strong></div><div className="flex justify-between text-slate-500"><span>Entrega</span><strong className="text-[#1F2A44]">{items.length ? brl.format(delivery) : brl.format(0)}</strong></div></div>
          <div className="my-5 border-t border-dashed border-[#E8DCC8]" />
          <div className="flex items-end justify-between"><span className="font-bold">Total</span><span className="text-2xl font-black">{brl.format(subtotal + (items.length ? delivery : 0))}</span></div>
          {items.length ? <Link href="/checkout" className="mt-5 flex h-14 items-center justify-center rounded-2xl bg-[#C6A75E] text-sm font-black text-[#1F2A44] shadow-sm transition hover:bg-[#C6A75E]">IR PARA O CHECKOUT</Link> : <button disabled className="mt-5 h-14 w-full rounded-2xl bg-[#E8DCC8] text-sm font-black text-slate-400">CARRINHO VAZIO</button>}
          <p className="mt-3 text-center text-[11px] text-slate-400">Preço e disponibilidade serão validados novamente ao finalizar.</p>
        </aside>
      </main>
    </div>
  );
}
