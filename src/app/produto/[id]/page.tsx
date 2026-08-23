"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { StoreHeader } from "@/components/store-header";
import { useCatalog } from "@/components/catalog-provider";
import { useCart } from "@/components/cart-provider";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const { products } = useCatalog();
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const product = products.find((item) => item.id === Number(params.id));

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F8F5EF]">
        <StoreHeader />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-5xl">🔎</p>
          <h1 className="mt-5 text-3xl font-black text-[#1F2A44]">Produto não encontrado</h1>
          <Link href="/" className="mt-6 inline-flex rounded-2xl bg-[#1F2A44] px-5 py-3 text-xs font-black text-white">VOLTAR À LOJA</Link>
        </main>
      </div>
    );
  }

  const unavailable = product.stock <= 0 || product.active === false;

  function addSelectedQuantity() {
    if (unavailable) return;
    for (let index = 0; index < qty; index += 1) addItem(product!);
  }

  return (
    <div className="min-h-screen bg-[#F8F5EF]">
      <StoreHeader />
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <Link href="/" className="text-sm font-black text-[#8A7040]">← Voltar para a loja</Link>

        <div className="mt-5 grid gap-6 rounded-[2rem] border border-[#E8DCC8] bg-[#fffdf9] p-5 shadow-sm md:grid-cols-2 md:p-7">
          <div className="product-photo relative grid min-h-72 place-items-center overflow-hidden rounded-[1.6rem] border border-[#E8DCC8]">
            {product.badge && <span className="absolute left-4 top-4 rounded-full bg-[#1F2A44] px-3 py-1.5 text-[10px] font-black uppercase text-white">{product.badge}</span>}
            {product.image ? (
              <img src={product.image} alt={product.name} className="h-full max-h-[380px] w-full object-contain p-6" />
            ) : (
              <span className="text-8xl">{product.emoji}</span>
            )}
          </div>

          <div className="flex flex-col">
            <p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">{product.category}</p>
            <h1 className="mt-2 text-3xl font-black text-[#1F2A44]">{product.name}</h1>
            <p className="mt-3 text-sm leading-6 text-[#777066]">Produto disponível para entrega rápida. A disponibilidade final será confirmada novamente ao finalizar o pedido.</p>

            {product.oldPrice && <p className="mt-6 text-sm font-bold text-[#9A9186] line-through">{brl.format(product.oldPrice)}</p>}
            <p className={`${product.oldPrice ? "mt-1" : "mt-6"} text-3xl font-black text-[#1F2A44]`}>{brl.format(product.price)}</p>

            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center gap-3 rounded-2xl bg-[#F4ECDF] p-1">
                <button onClick={() => setQty((current) => Math.max(1, current - 1))} className="grid size-10 place-items-center rounded-xl bg-white font-black text-[#1F2A44]">−</button>
                <span className="w-6 text-center font-black text-[#1F2A44]">{qty}</span>
                <button onClick={() => setQty((current) => Math.min(product.stock, current + 1))} className="grid size-10 place-items-center rounded-xl bg-white font-black text-[#1F2A44]">+</button>
              </div>
              <button onClick={addSelectedQuantity} disabled={unavailable} className="h-12 flex-1 rounded-2xl bg-[#C6A75E] px-4 text-sm font-black text-[#1F2A44] transition hover:bg-[#D6BB78] disabled:cursor-not-allowed disabled:opacity-45">
                {unavailable ? "INDISPONÍVEL" : "ADICIONAR AO CARRINHO"}
              </button>
            </div>

            <p className="mt-auto pt-6 text-xs font-semibold text-[#8B8277]">Saldo disponível: {product.stock} unidades</p>
          </div>
        </div>
      </main>
    </div>
  );
}
