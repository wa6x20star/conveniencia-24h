"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";

export function StoreHeader() {
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-[#E8DCC8] bg-[#fffdf9]/95 backdrop-blur">
      <div className="hidden bg-[#1F2A44] text-[#F7F2E9] md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2 text-[11px] font-bold">
          <span>● Conveniência online 24 horas</span>
          <div className="flex items-center gap-6">
            <span>Entrega rápida</span>
            <span>Pagamento fácil</span>
            <Link href="/pedido/demo" className="transition hover:text-[#C6A75E]">Acompanhar pedido</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-6 md:py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-black tracking-tight text-[#1F2A44]">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#C6A75E] text-lg text-[#1F2A44] shadow-sm">⚡</span>
          <span className="hidden text-lg sm:block">Conveniência 24h</span>
        </Link>

        <div className="min-w-0 flex-1 md:hidden">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#8F7B5B]">Entregar em</p>
          <button className="flex max-w-full items-center gap-1 truncate text-sm font-black text-[#1F2A44]">
            📍 Piedade, Jaboatão <span className="text-[#C6A75E]">⌄</span>
          </button>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-6 text-sm font-bold text-[#1F2A44] md:flex">
          <Link href="/#categorias" className="transition hover:text-[#A88A45]">Categorias</Link>
          <Link href="/#mais-vendidos" className="transition hover:text-[#A88A45]">Mais vendidos</Link>
          <Link href="/#ofertas" className="transition hover:text-[#A88A45]">Ofertas</Link>
          <Link href="/pedido/demo" className="transition hover:text-[#A88A45]">Meus pedidos</Link>
        </nav>

        <div className="hidden min-w-0 md:block">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#8F7B5B]">Entregar em</p>
          <button className="max-w-44 truncate text-sm font-black text-[#1F2A44]">📍 Piedade, Jaboatão</button>
        </div>

        <Link
          href="/carrinho"
          className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-[#1F2A44] text-lg text-white shadow-sm transition hover:bg-[#151D31]"
          aria-label="Abrir carrinho"
        >
          🛒
          {totalItems > 0 && (
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[#C6A75E] text-[10px] font-black text-[#1F2A44]">
              {totalItems > 9 ? "9+" : totalItems}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
