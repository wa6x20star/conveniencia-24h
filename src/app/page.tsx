"use client";

import { useMemo, useState } from "react";
import { ArrowIcon, ClockIcon, DeliveryIcon, SearchIcon, ShieldIcon, TagIcon, HeadsetIcon } from "@/components/brand-icons";
import { BottomNav } from "@/components/bottom-nav";
import { ProductCard } from "@/components/product-card";
import { SiteFooter } from "@/components/site-footer";
import { StoreHeader } from "@/components/store-header";
import { useCatalog } from "@/components/catalog-provider";
import { categories } from "@/lib/mock-data";
import { DEFAULT_CITY, DEFAULT_STATE } from "@/lib/config";

const quickTerms = ["Água", "Gelo", "Chocolate", "Doritos", "Refrigerante"];
const heroHighlights = [
  { Icon: DeliveryIcon, title: "Entrega rápida", text: "Chegou, pediu, recebeu." },
  { Icon: ClockIcon, title: "Aberto 24h", text: "Sempre que você precisar." },
  { Icon: ShieldIcon, title: "Pagamento fácil", text: "Pix, cartão e dinheiro." },
  { Icon: HeadsetIcon, title: "Pedido pelo WhatsApp", text: "Fale com a gente agora." },
];

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

      <main className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7">
        <section className="brand-shadow overflow-hidden rounded-[2rem] border border-[#E8DCC8] bg-[#FFFDF9]">
          <div className="grid gap-8 px-5 pb-6 pt-6 md:grid-cols-[1.02fr_.98fr] md:px-8 md:pb-0 md:pt-8 lg:px-10 lg:pt-10">
            <div className="flex flex-col justify-center pb-0 md:pb-10">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#C6A75E] px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.22em] text-[#1F2A44]">
                <ClockIcon className="size-4" /> Aberto 24 horas
              </span>

              <h1 className="mt-6 max-w-xl text-[3.35rem] font-extrabold leading-[0.94] tracking-[-.06em] text-[#1F2A44] md:text-[4.3rem] lg:text-[5.4rem]">
                Faltou? <br />
                <span className="text-[#C6A75E]">A gente leva.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base font-medium leading-7 text-[#4E4A43] md:text-[1.1rem]">
                Bebidas, bomboniere, snacks e itens do dia a dia com <strong className="font-extrabold text-[#1F2A44]">entrega rápida</strong> em {DEFAULT_CITY} e região.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#mais-vendidos" className="brand-btn-primary h-14 px-7 text-sm uppercase tracking-[.08em]">
                  Fazer pedido <ArrowIcon className="size-4" />
                </a>
                <a href="#categorias" className="inline-flex h-14 items-center justify-center rounded-2xl border border-[#1F2A44]/28 bg-white px-7 text-sm font-extrabold uppercase tracking-[.08em] text-[#1F2A44] transition hover:border-[#C6A75E] hover:text-[#A88A45]">
                  Ver categorias
                </a>
              </div>
            </div>

            <div className="relative flex min-h-[360px] items-end justify-center md:min-h-[560px]">
              <div className="absolute right-[-100px] top-[-40px] size-72 rounded-full border-[36px] border-[#EDE5D6] opacity-90 md:size-[26rem] md:border-[44px]" />
              <div className="absolute bottom-16 left-8 h-2 w-24 rounded-full bg-[#C6A75E] opacity-70 shadow-[0_16px_28px_rgba(198,167,94,.35)]" />
              <div className="absolute bottom-24 left-8 h-2 w-32 rounded-full bg-[#C6A75E] opacity-60" />
              <div className="absolute bottom-32 left-8 h-2 w-24 rounded-full bg-[#C6A75E] opacity-50" />
              <img
                src="/hero/hero-bag.png"
                alt="Sacola da Conveniência 24h com bebidas, snacks e bomboniere"
                className="relative z-10 max-h-[560px] w-auto object-contain md:translate-x-8 lg:max-h-[610px]"
              />
            </div>
          </div>

          <div className="border-t border-[#EEE5D8] bg-[#FFFDF9] px-5 pb-5 pt-4 md:px-8 md:pt-0 lg:px-10">
            <div className="brand-shadow translate-y-0 rounded-[1.6rem] border border-[#E8DCC8] bg-white p-3 md:-mt-8 md:p-4">
              <div className="flex flex-col gap-3">
                <label className="relative block">
                  <SearchIcon className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#A88A45]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="brand-input h-[58px] w-full rounded-2xl border-[#E5D8C0] pl-12 pr-32 text-sm font-semibold placeholder:text-[#9A9186]"
                    placeholder="O que você precisa agora?"
                  />
                  <button className="absolute right-2 top-1/2 inline-flex h-11 -translate-y-1/2 items-center rounded-2xl bg-[#1F2A44] px-5 text-sm font-bold text-white transition hover:bg-[#162038]">
                    Buscar
                  </button>
                </label>

                <div className="flex flex-wrap items-center gap-2 px-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#8E8375]">Mais buscados:</span>
                  {quickTerms.map((term) => (
                    <button key={term} onClick={() => setQuery(term)} className="rounded-full bg-[#F4ECDF] px-4 py-2 text-sm font-bold text-[#675F55] transition hover:bg-[#E8DCC8] hover:text-[#1F2A44]">
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {heroHighlights.map(({ Icon, title, text }) => (
                <div key={title} className="flex items-start gap-3 rounded-[1.4rem] border border-[#EEE5D8] bg-[#FFFDF9] p-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#F4ECDF] text-[#1F2A44]">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-display text-base font-bold text-[#1F2A44]">{title}</p>
                    <p className="mt-0.5 text-sm font-medium text-[#736C61]">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="categorias" className="mt-10">
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
            { Icon: TagIcon, title: "Ofertas frequentes", text: "Combos e destaques da noite." },
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
