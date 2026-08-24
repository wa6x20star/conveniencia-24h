"use client";

import { useMemo, useState } from "react";
import { ArrowIcon, ClockIcon, DeliveryIcon, SearchIcon, ShieldIcon } from "@/components/brand-icons";
import { BrandMark } from "@/components/brand-logo";
import { BottomNav } from "@/components/bottom-nav";
import { ProductCard } from "@/components/product-card";
import { SiteFooter } from "@/components/site-footer";
import { StoreHeader } from "@/components/store-header";
import { useCatalog } from "@/components/catalog-provider";
import { categories } from "@/lib/mock-data";

const quickTerms = ["Água", "Gelo", "Chocolate", "Doritos", "Refrigerante"];

export default function Home() {
  const { products } = useCatalog();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) => {
      const active = product.active !== false;
      const matchesCategory = !category || product.category.toLocaleLowerCase("pt-BR") === category;
      const matchesQuery = !normalized || product.name.toLocaleLowerCase("pt-BR").includes(normalized) || product.category.toLocaleLowerCase("pt-BR").includes(normalized);
      return active && matchesCategory && matchesQuery;
    });
  }, [products, query, category]);

  return (
    <div className="min-h-screen bg-[#F8F5EF] pb-24 md:pb-4">
      <StoreHeader />

      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-7">
        <section className="brand-grid brand-shadow relative overflow-hidden rounded-[2rem] bg-[#1F2A44] text-white md:grid md:min-h-[390px] md:grid-cols-[1.08fr_.92fr]">
          <div className="relative z-10 flex flex-col justify-center p-6 md:p-10 lg:p-12">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#C6A75E] px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[.16em] text-[#1F2A44]">
              <ClockIcon className="size-3.5" /> Aberto 24 horas
            </span>

            <h1 className="mt-5 max-w-xl text-4xl font-extrabold leading-[1.03] tracking-[-.045em] md:text-5xl lg:text-[3.65rem]">
              O que você precisa, <span className="text-[#C6A75E]">na sua porta.</span>
            </h1>

            <p className="mt-4 max-w-lg text-sm font-medium leading-6 text-[#E8DCC8] md:text-[15px]">
              Produtos do dia a dia, bomboniere e necessidades de última hora com uma compra simples, rápida e sem burocracia.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#mais-vendidos" className="brand-btn-primary h-12 px-5 text-xs uppercase tracking-wide">
                Fazer pedido agora <ArrowIcon className="size-4" />
              </a>
              <a href="#categorias" className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/35 px-5 text-xs font-extrabold uppercase tracking-wide text-white transition hover:border-[#C6A75E] hover:text-[#C6A75E]">
                Ver categorias
              </a>
            </div>
          </div>

          <div className="relative min-h-72 overflow-hidden md:min-h-full">
            <div className="absolute right-[-80px] top-[-90px] size-80 rounded-full border-[48px] border-[#C6A75E]/12" />
            <div className="absolute bottom-[-120px] left-4 size-80 rounded-full bg-[#C6A75E]/10 blur-2xl" />

            <div className="relative z-10 flex h-full min-h-72 items-center justify-center p-6 md:p-8">
              <div className="relative h-72 w-full max-w-md">
                <div className="absolute left-1/2 top-1/2 h-52 w-48 -translate-x-1/2 -translate-y-1/2 rounded-[2.7rem] bg-[#F6F4F1] shadow-[0_28px_70px_rgba(0,0,0,.3)]" />
                <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
                  <BrandMark className="size-40" />
                </div>

                <div className="absolute left-[5%] top-[8%] z-30 grid size-24 place-items-center overflow-hidden rounded-[1.7rem] bg-[#E8DCC8] p-2.5 shadow-xl md:size-28">
                  <img src="https://carrefourbrfood.vtexassets.com/arquivos/ids/193842562/salgadinho-queijo-nacho-doritos-120g-1.jpg?v=638876002921530000" alt="Doritos" className="h-full w-full object-contain" />
                </div>
                <div className="absolute right-[3%] top-[16%] z-30 grid size-20 place-items-center overflow-hidden rounded-[1.5rem] bg-[#C6A75E] p-2.5 shadow-xl md:size-24">
                  <img src="https://down-br.img.susercontent.com/file/de3905e6d774d25363e21ac6a2ff7297" alt="Red Bull" className="h-full w-full object-contain" />
                </div>
                <div className="absolute bottom-[0%] left-[10%] z-30 grid size-20 place-items-center overflow-hidden rounded-[1.5rem] bg-[#fffdf9] p-2.5 shadow-xl md:size-24">
                  <img src="https://images.tcdn.com.br/img/img_prod/1377318/chocolate_bis_100_8g_ao_leite_169_1_bc46a4e81dee4e6402c7608e4f4802f0.jpg" alt="Bis" className="h-full w-full object-contain" />
                </div>
                <div className="absolute bottom-[4%] right-[8%] z-30 grid size-24 place-items-center overflow-hidden rounded-[1.7rem] bg-[#E8DCC8] p-2 shadow-xl md:size-28">
                  <img src="https://www.powellsnl.ca/media/uploads/gs1/06700000427_20.png" alt="Coca-Cola" className="h-full w-full object-contain" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="buscar" className="relative z-20 -mt-2 md:-mt-8 md:px-8">
          <div className="brand-shadow rounded-[1.4rem] border border-[#E8DCC8] bg-[#fffdf9] p-2.5 md:p-3">
            <label className="relative block">
              <SearchIcon className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#A88A45]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="brand-input h-[52px] w-full rounded-xl pl-12 pr-4 text-sm font-semibold placeholder:text-[#9A9186] md:h-14"
                placeholder="O que você precisa agora?"
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2 px-1 pb-1">
              <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#8E8375]">Mais buscados:</span>
              {quickTerms.map((term) => (
                <button key={term} onClick={() => setQuery(term)} className="rounded-full bg-[#F4ECDF] px-2.5 py-1 text-[9px] font-bold text-[#675F55] transition hover:bg-[#E8DCC8] hover:text-[#1F2A44]">
                  {term}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="categorias" className="mt-9">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="brand-eyebrow">Encontre rápido</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-[-.03em] text-[#1F2A44]">Compre por categoria</h2>
            </div>
            {category && <button onClick={() => setCategory("")} className="text-[10px] font-extrabold uppercase text-[#A88A45]">Limpar filtro</button>}
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
            {categories.map((item) => {
              const slug = item.name.toLocaleLowerCase("pt-BR");
              const selected = category === slug;
              return (
                <button key={item.slug} onClick={() => setCategory(selected ? "" : slug)} className={`group flex min-w-0 flex-col items-center gap-2 rounded-[1.2rem] border p-3 text-center transition ${selected ? "border-[#C6A75E] bg-[#1F2A44] text-white shadow-md" : "border-[#E8DCC8] bg-[#fffdf9] text-[#1F2A44] hover:-translate-y-0.5 hover:border-[#C6A75E]"}`}>
                  <span className={`grid size-11 place-items-center rounded-xl text-xl transition ${selected ? "bg-white/10" : "bg-[#F4ECDF] group-hover:bg-[#E8DCC8]"}`}>{item.icon}</span>
                  <span className="w-full truncate text-[10px] font-extrabold">{item.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-3 md:grid-cols-3">
          {[
            { Icon: ClockIcon, title: "Disponível 24h", text: "Compre quando precisar." },
            { Icon: DeliveryIcon, title: "Entrega rápida", text: "Fluxo pensado para agilidade." },
            { Icon: ShieldIcon, title: "Compra simples", text: "Poucos passos até finalizar." },
          ].map(({ Icon, title, text }) => (
            <div key={title} className="brand-card flex items-center gap-3 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#F4ECDF] text-[#A88A45]"><Icon className="size-6" /></span>
              <div><p className="font-display text-sm font-bold text-[#1F2A44]">{title}</p><p className="mt-0.5 text-xs font-medium text-[#777066]">{text}</p></div>
            </div>
          ))}
        </section>

        <section id="mais-vendidos" className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="brand-eyebrow">Escolhas rápidas</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-[-.03em] text-[#1F2A44]">{query || category ? "Resultados" : "Mais vendidos"}</h2>
            </div>
            <span className="text-[10px] font-bold text-[#8B8277]">{visibleProducts.length} produtos</span>
          </div>

          {visibleProducts.length ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          ) : (
            <div className="brand-card p-10 text-center"><SearchIcon className="mx-auto size-9 text-[#C6A75E]" /><p className="mt-3 font-display font-bold text-[#1F2A44]">Nenhum produto encontrado.</p><button onClick={() => { setQuery(""); setCategory(""); }} className="brand-btn-secondary mt-4 h-10 px-4 text-[10px] uppercase">Limpar busca</button></div>
          )}
        </section>

        <section id="ofertas" className="mt-10 grid gap-4 md:grid-cols-[1.15fr_.85fr]">
          <div className="brand-grid relative overflow-hidden rounded-[2rem] bg-[#1F2A44] p-7 text-white md:p-8">
            <div className="absolute right-[-50px] top-[-60px] size-48 rounded-full border-[34px] border-[#C6A75E]/18" />
            <p className="brand-eyebrow !text-[#C6A75E]">Combo da noite</p>
            <h3 className="mt-2 max-w-md text-3xl font-extrabold leading-tight">Filme + snacks sem sair de casa.</h3>
            <p className="mt-3 max-w-md text-sm font-medium leading-6 text-[#E8DCC8]">Refrigerante, chocolate e salgadinho em uma seleção rápida para a madrugada.</p>
            <a href="#mais-vendidos" className="brand-btn-primary mt-5 h-11 px-5 text-[10px] uppercase">Montar pedido <ArrowIcon className="size-4" /></a>
          </div>

          <div className="rounded-[2rem] border border-[#D7C29C] bg-[#E8DCC8] p-7 md:p-8">
            <p className="brand-eyebrow">Compra recorrente</p>
            <h3 className="mt-2 text-2xl font-extrabold leading-tight text-[#1F2A44]">Pedir novamente vai ser ainda mais rápido.</h3>
            <p className="mt-3 text-sm font-medium leading-6 text-[#625B52]">A estrutura está preparada para repetir pedidos anteriores e ajustar somente o necessário.</p>
          </div>
        </section>
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}
