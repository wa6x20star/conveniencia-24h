"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";

export function StoreHeader() {
  const { totalItems } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-black tracking-tight text-slate-950">
          <span className="grid size-10 place-items-center rounded-2xl bg-emerald-500 text-xl shadow-sm">⚡</span>
          <span className="hidden sm:block">Conveniência 24h</span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500">Entregar em</p>
          <button className="flex max-w-full items-center gap-1 truncate text-sm font-bold text-slate-900">📍 Piedade, Jaboatão <span className="text-slate-400">⌄</span></button>
        </div>
        <Link href="/carrinho" className="relative grid size-11 place-items-center rounded-2xl bg-slate-950 text-lg text-white shadow-sm" aria-label="Abrir carrinho">
          🛒
          {totalItems > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-emerald-400 text-[10px] font-black text-slate-950">{totalItems > 9 ? "9+" : totalItems}</span>}
        </Link>
      </div>
    </header>
  );
}
