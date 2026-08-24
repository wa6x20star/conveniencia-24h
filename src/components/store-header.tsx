"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { CartIcon } from "@/components/brand-icons";
import { useCart } from "@/components/cart-provider";

export function StoreHeader() {
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-[#E8DCC8] bg-[#fffdf9]/96 backdrop-blur-xl">
      <div className="hidden bg-[#1F2A44] text-[#F7F2E9] md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2 text-[10px] font-bold tracking-wide">
          <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[#C6A75E]" /> ABERTO 24 HORAS</span>
          <div className="flex items-center gap-6 text-[#E8DCC8]">
            <span>Entrega rápida</span>
            <span>Compra simples</span>
            <Link href="/pedido/demo" className="transition hover:text-[#C6A75E]">Acompanhar pedido</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
        <BrandLogo tagline />

        <div className="min-w-0 flex-1 md:hidden">
          <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#8F7B5B]">Entregar em</p>
          <button className="flex max-w-full items-center gap-1 truncate text-sm font-extrabold text-[#1F2A44]">
            <span className="text-[#C6A75E]">●</span> Piedade, Jaboatão <span className="text-[#C6A75E]">⌄</span>
          </button>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-6 text-[13px] font-bold text-[#1F2A44] md:flex">
          <Link href="/#categorias" className="transition hover:text-[#A88A45]">Categorias</Link>
          <Link href="/#mais-vendidos" className="transition hover:text-[#A88A45]">Mais vendidos</Link>
          <Link href="/#ofertas" className="transition hover:text-[#A88A45]">Ofertas</Link>
          <Link href="/pedido/demo" className="transition hover:text-[#A88A45]">Meus pedidos</Link>
        </nav>

        <div className="hidden min-w-0 border-l border-[#E8DCC8] pl-5 md:block">
          <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#8F7B5B]">Entregar em</p>
          <button className="max-w-40 truncate text-xs font-extrabold text-[#1F2A44]">Piedade, Jaboatão</button>
        </div>

        <Link
          href="/carrinho"
          className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-[#1F2A44] text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#151D31]"
          aria-label="Abrir carrinho"
        >
          <CartIcon className="size-5" />
          {totalItems > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[#C6A75E] text-[9px] font-extrabold text-[#1F2A44] ring-2 ring-[#fffdf9]">
              {totalItems > 9 ? "9+" : totalItems}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
