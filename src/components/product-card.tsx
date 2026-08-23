"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  stock: number;
  badge: string;
  emoji: string;
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ProductCard({ product }: { product: Product }) {
  const { addItem, items } = useCart();
  const qty = items.find((item) => item.id === product.id)?.qty ?? 0;

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(15,23,42,.09)]">
      <div className="relative grid aspect-[1.15] place-items-center bg-gradient-to-br from-slate-50 to-slate-100 text-6xl">
        {product.badge && <span className="absolute left-3 top-3 rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">{product.badge}</span>}
        <span className="transition duration-300 group-hover:scale-110">{product.emoji}</span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{product.category}</p>
        <Link href={`/produto/${product.id}`} className="mt-1 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-900">{product.name}</Link>
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            {product.oldPrice && <p className="text-[11px] text-slate-400 line-through">{brl.format(product.oldPrice)}</p>}
            <p className="text-base font-black text-slate-950">{brl.format(product.price)}</p>
          </div>
          <button onClick={() => addItem(product)} className="relative grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-xl font-black text-slate-950 shadow-sm transition hover:bg-emerald-400" aria-label={`Adicionar ${product.name}`}>
            +{qty > 0 && <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-slate-950 text-[9px] text-white">{qty}</span>}
          </button>
        </div>
      </div>
    </article>
  );
}
