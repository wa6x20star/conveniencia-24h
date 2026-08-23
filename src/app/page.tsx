import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { ProductCard } from "@/components/product-card";
import { StoreHeader } from "@/components/store-header";
import { categories, products } from "@/lib/mock-data";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10">
      <StoreHeader />
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl md:grid md:grid-cols-[1.3fr_.7fr] md:items-center md:p-8">
          <div>
            <span className="inline-flex rounded-full bg-emerald-400 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950">Aberto 24 horas</span>
            <h1 className="mt-4 max-w-xl text-3xl font-black leading-tight tracking-tight md:text-5xl">O que você precisa, na sua porta.</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300 md:text-base">Produtos do dia a dia, bomboniere e necessidades de última hora com uma compra rápida e sem burocracia.</p>
          </div>
          <div className="mt-6 grid min-h-40 place-items-center rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-emerald-950 text-7xl md:mt-0 md:min-h-56">🛵</div>
        </section>

        <section id="buscar" className="mt-5">
          <label className="relative block">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400">⌕</span>
            <input className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold outline-none shadow-sm transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" placeholder="O que você precisa agora?" />
          </label>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between">
            <div><p className="text-xs font-black uppercase tracking-wider text-emerald-600">Encontre rápido</p><h2 className="mt-1 text-xl font-black text-slate-950">Categorias</h2></div>
            <button className="text-xs font-bold text-slate-500">Ver todas</button>
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
            {categories.map((category) => (
              <Link key={category.slug} href={`/?categoria=${category.slug}`} className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300">
                <span className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-2xl">{category.icon}</span>
                <span className="w-full truncate text-[11px] font-bold text-slate-700">{category.name}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-9">
          <div className="mb-4 flex items-end justify-between">
            <div><p className="text-xs font-black uppercase tracking-wider text-emerald-600">Escolhas rápidas</p><h2 className="mt-1 text-xl font-black text-slate-950">Mais vendidos</h2></div>
            <span className="text-xs font-semibold text-slate-400">Entrega 24h</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-[2rem] bg-emerald-400 p-6 text-slate-950">
            <p className="text-xs font-black uppercase tracking-wider">Combo da noite</p>
            <h3 className="mt-2 text-2xl font-black">Filme + snacks sem sair de casa.</h3>
            <p className="mt-2 text-sm font-medium text-emerald-950/80">Refrigerante, pipoca, chocolate e salgadinho em um clique.</p>
            <button className="mt-5 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white">VER COMBO</button>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Compra recorrente</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">Pedir de novo vai ser ainda mais rápido.</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Depois da primeira compra, o cliente poderá repetir um pedido anterior e ajustar apenas o necessário.</p>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
