"use client";

import { useMemo, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { ProductCard } from "@/components/product-card";
import { StoreHeader } from "@/components/store-header";
import { useCatalog } from "@/components/catalog-provider";
import { categories } from "@/lib/mock-data";

export default function Home() {
  const { products } = useCatalog();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) => {
      const active = product.active !== false;
      const matchesCategory = !category || product.category.toLocaleLowerCase("pt-BR") === category;
      const matchesQuery =
        !normalized ||
        product.name.toLocaleLowerCase("pt-BR").includes(normalized) ||
        product.category.toLocaleLowerCase("pt-BR").includes(normalized);
      return active && matchesCategory && matchesQuery;
    });
  }, [products, query, category]);

  return (
    <div className="min-h-screen bg-[#F8F5EF] pb-24 md:pb-10">
      <StoreHeader />

      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-7">
        <section className="brand-shadow relative overflow-hidden rounded-[2rem] border border-[#E8DCC8] bg-[#F4ECDF] md:grid md:min-h-[360px] md:grid-cols-[1.02fr_.98fr] md:items-stretch">
          <div className="relative z-10 flex flex-col justify-center p-6 md:p-10 lg:p-12">
            <span className="inline-flex w-fit rounded-full bg-[#1F2A44] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-[#F7F2E9]">
              Aberto 24 horas
            </span>

            <h1 className="mt-5 max-w-xl text-4xl font-black leading-[1.02] tracking-[-.035em] text-[#1F2A44] md:text-5xl lg:text-6xl">
              Sua conveniência, <span className="text-[#A88A45]">sem sair de casa.</span>
            </h1>

            <p className="mt-4 max-w-lg text-sm font-medium leading-6 text-[#5E5A55] md:text-base">
              Bebidas, bomboniere, gelo e itens do dia a dia em uma compra simples, rápida e disponível a qualquer hora.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#mais-vendidos"
                className="rounded-2xl bg-[#1F2A44] px-5 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-[#151D31]"
              >
                Comprar agora
              </a>
              <a
                href="#categorias"
                className="rounded-2xl border border-[#C6A75E] bg-[#fffdf9] px-5 py-3 text-xs font-black uppercase tracking-wide text-[#1F2A44] transition hover:bg-[#E8DCC8]"
              >
                Ver categorias
              </a>
            </div>
          </div>

          <div className="relative min-h-60 overflow-hidden bg-[#1F2A44] md:min-h-full">
            <div className="absolute -right-14 -top-14 size-56 rounded-full border-[36px] border-[#C6A75E]/25" />
            <div className="absolute -bottom-20 -left-16 size-64 rounded-full bg-[#C6A75E]/15 blur-sm" />

            <div className="relative z-10 grid h-full min-h-60 place-items-center p-6">
              <div className="relative grid size-56 place-items-center rounded-[3rem] bg-[#fffdf9] shadow-2xl md:size-64">
                <span className="absolute -left-8 top-10 grid size-20 place-items-center rounded-3xl bg-[#E8DCC8] text-4xl shadow-lg">🥤</span>
                <span className="absolute -right-7 top-6 grid size-20 place-items-center rounded-3xl bg-[#C6A75E] text-4xl shadow-lg">🍫</span>
                <span className="absolute -bottom-6 left-4 grid size-20 place-items-center rounded-3xl bg-[#F7F2E9] text-4xl shadow-lg">🧊</span>
                <span className="absolute -bottom-8 right-3 grid size-20 place-items-center rounded-3xl bg-[#E8DCC8] text-4xl shadow-lg">🍿</span>
                <span className="text-8xl">🛍️</span>
              </div>
            </div>
          </div>
        </section>

        <section id="buscar" className="relative z-20 -mt-1 md:-mt-7 md:px-8">
          <label className="brand-shadow relative block">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-[#A88A45]">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-16 w-full rounded-2xl border border-[#E8DCC8] bg-[#fffdf9] pl-12 pr-4 text-sm font-bold text-[#1F2A44] outline-none transition placeholder:text-[#9A9186] focus:border-[#C6A75E] focus:ring-4 focus:ring-[#C6A75E]/15"
              placeholder="O que você precisa agora?"
            />
          </label>
        </section>

        <section id="categorias" className="mt-9">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#A88A45]">Encontre rápido</p>
              <h2 className="mt-1 text-2xl font-black text-[#1F2A44]">Compre por categoria</h2>
            </div>
            {category && (
              <button onClick={() => setCategory("")} className="text-xs font-black text-[#A88A45]">
                Limpar filtro
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
            {categories.map((item) => {
              const slug = item.name.toLocaleLowerCase("pt-BR");
              const selected = category === slug;
              return (
                <button
                  key={item.slug}
                  onClick={() => setCategory(selected ? "" : slug)}
                  className={`flex min-w-0 flex-col items-center gap-2 rounded-2xl border p-3 text-center transition ${
                    selected
                      ? "border-[#C6A75E] bg-[#1F2A44] text-white shadow-md"
                      : "border-[#E8DCC8] bg-[#fffdf9] text-[#1F2A44] hover:-translate-y-0.5 hover:border-[#C6A75E]"
                  }`}
                >
                  <span className={`grid size-11 place-items-center rounded-2xl text-2xl ${selected ? "bg-white/10" : "bg-[#F4ECDF]"}`}>
                    {item.icon}
                  </span>
                  <span className="w-full truncate text-[11px] font-black">{item.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-3 md:grid-cols-3">
          {[
            ["🕐", "Disponível 24h", "Compre quando precisar."],
            ["🛵", "Entrega rápida", "Fluxo pensado para agilidade."],
            ["🔒", "Compra simples", "Poucos passos até finalizar."],
          ].map(([icon, title, text]) => (
            <div key={title} className="flex items-center gap-3 rounded-2xl border border-[#E8DCC8] bg-[#fffdf9] p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#E8DCC8] text-xl">{icon}</span>
              <div>
                <p className="text-sm font-black text-[#1F2A44]">{title}</p>
                <p className="mt-0.5 text-xs font-medium text-[#777066]">{text}</p>
              </div>
            </div>
          ))}
        </section>

        <section id="mais-vendidos" className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#A88A45]">Escolhas rápidas</p>
              <h2 className="mt-1 text-2xl font-black text-[#1F2A44]">
                {query || category ? "Resultados" : "Mais vendidos"}
              </h2>
            </div>
            <span className="text-xs font-bold text-[#8B8277]">{visibleProducts.length} produtos</span>
          </div>

          {visibleProducts.length ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-[#C6A75E] bg-[#fffdf9] p-10 text-center">
              <p className="text-3xl">🔎</p>
              <p className="mt-3 font-black text-[#1F2A44]">Nenhum produto encontrado.</p>
              <button
                onClick={() => { setQuery(""); setCategory(""); }}
                className="mt-4 rounded-xl bg-[#1F2A44] px-4 py-2.5 text-xs font-black text-white"
              >
                LIMPAR BUSCA
              </button>
            </div>
          )}
        </section>

        <section id="ofertas" className="mt-10 grid gap-4 md:grid-cols-[1.2fr_.8fr]">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#1F2A44] p-7 text-white md:p-8">
            <div className="absolute right-[-40px] top-[-50px] size-44 rounded-full border-[30px] border-[#C6A75E]/20" />
            <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#C6A75E]">Combo da noite</p>
            <h3 className="mt-2 max-w-md text-3xl font-black leading-tight">Filme + snacks sem sair de casa.</h3>
            <p className="mt-3 max-w-md text-sm font-medium leading-6 text-[#E8DCC8]">
              Refrigerante, pipoca, chocolate e salgadinho em uma seleção rápida.
            </p>
            <button className="mt-5 rounded-2xl bg-[#C6A75E] px-5 py-3 text-xs font-black text-[#1F2A44]">
              VER COMBO
            </button>
          </div>

          <div className="rounded-[2rem] border border-[#E8DCC8] bg-[#E8DCC8] p-7 md:p-8">
            <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#8A7040]">Compra recorrente</p>
            <h3 className="mt-2 text-2xl font-black text-[#1F2A44]">Pedir novamente vai ser ainda mais rápido.</h3>
            <p className="mt-3 text-sm font-medium leading-6 text-[#625B52]">
              A estrutura já está preparada para repetir pedidos anteriores e ajustar somente o necessário.
            </p>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
