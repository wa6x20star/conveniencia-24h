"use client";

import Link from "next/link";
import { CartIcon } from "@/components/brand-icons";
import { useCart } from "@/components/cart-provider";
import type { Product } from "@/lib/mock-data";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ProductCard({ product }: { product: Product }) {
  const { addItem, items } = useCart();
  const qty = items.find((item) => item.id === product.id)?.qty ?? 0;
  const unavailable = product.stock <= 0 || product.active === false;

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[1.35rem] border border-[#E8DCC8] bg-[#fffdf9] shadow-[0_8px_28px_rgba(31,42,68,.055)] transition duration-300 hover:-translate-y-1 hover:border-[#D6BB78] hover:shadow-[0_16px_42px_rgba(31,42,68,.11)]">
      <div className="product-photo relative grid aspect-[1.08] place-items-center overflow-hidden">
        {product.badge && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-[#1F2A44] px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[.12em] text-white">
            {product.badge}
          </span>
        )}
        <span className="absolute right-3 top-3 z-10 grid size-7 place-items-center rounded-full bg-white/90 text-[13px] text-[#7C7469] shadow-sm">♡</span>

        {product.image ? (
          <img src={product.image} alt={product.name} className="h-full w-full object-contain p-4 transition duration-300 group-hover:scale-[1.045]" />
        ) : (
          <span className="text-6xl transition duration-300 group-hover:scale-110">{product.emoji}</span>
        )}

        {unavailable && (
          <div className="absolute inset-0 grid place-items-center bg-[#fffdf9]/82 backdrop-blur-[1px]">
            <span className="rounded-full bg-[#1F2A44] px-3 py-1.5 text-[9px] font-extrabold uppercase text-white">Indisponível</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#A88A45]">{product.category}</p>
        <Link href={`/produto/${product.id}`} className="mt-1 line-clamp-2 min-h-10 text-[13px] font-extrabold leading-5 text-[#1F2A44]">
          {product.name}
        </Link>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            {product.oldPrice && <p className="text-[10px] font-medium text-[#988D7D] line-through">{brl.format(product.oldPrice)}</p>}
            <p className="font-display text-[1.05rem] font-extrabold text-[#1F2A44]">{brl.format(product.price)}</p>
          </div>

          <button
            onClick={() => !unavailable && addItem(product)}
            disabled={unavailable}
            className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-[#C6A75E] text-[#1F2A44] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#D6BB78] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Adicionar ${product.name}`}
          >
            <CartIcon className="size-[18px]" />
            {qty > 0 && <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[#1F2A44] text-[8px] font-extrabold text-white">{qty}</span>}
          </button>
        </div>
      </div>
    </article>
  );
}
