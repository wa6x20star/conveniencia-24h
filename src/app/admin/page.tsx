import Link from "next/link";
import { StatCard } from "@/components/stat-card";
import { adminOrders, lowStock } from "@/lib/mock-data";

export default function AdminHome() {
  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">Operação agora</p><h1 className="mt-1 text-3xl font-black tracking-tight">Visão geral</h1><p className="mt-1 text-sm text-slate-500">Foco no que precisa de ação, sem excesso de gráficos.</p></div><Link href="/admin/pedidos" className="rounded-2xl bg-[#1F2A44] px-4 py-3 text-xs font-black text-white">ABRIR CENTRAL DE PEDIDOS</Link></div>
      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Vendas hoje" value="R$ 1.842" note="63 pedidos concluídos" /><StatCard label="Ticket médio" value="R$ 29,24" note="+4,2% vs. ontem" /><StatCard label="Novos" value="8" note="Aguardando separação" /><StatCard label="Em entrega" value="6" note="3 entregadores ativos" /></section>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <section className="rounded-[2rem] border border-[#E8DCC8] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Últimos pedidos</p><h2 className="mt-1 text-xl font-black">Fila operacional</h2></div><Link href="/admin/pedidos" className="text-xs font-bold text-[#A88A45]">Ver todos</Link></div><div className="mt-4 space-y-2">{adminOrders.map((order) => <div key={order.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-slate-100 p-3"><span className="grid size-10 place-items-center rounded-xl bg-[#F4ECDF] text-xs font-black">{order.time}</span><div className="min-w-0"><p className="truncate text-sm font-black">{order.id} • {order.customer}</p><p className="mt-0.5 text-xs text-slate-400">{order.items} itens • {order.payment}</p></div><span className="rounded-full bg-[#F4ECDF] px-2.5 py-1 text-[10px] font-black">{order.status}</span></div>)}</div></section>
        <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-black uppercase tracking-wider text-amber-700">Atenção</p><h2 className="mt-1 text-xl font-black text-[#1F2A44]">Estoque baixo</h2><div className="mt-4 space-y-3">{lowStock.map((item) => <div key={item.product} className="rounded-2xl bg-white/80 p-3"><div className="flex justify-between gap-3"><p className="text-sm font-black">{item.product}</p><span className="text-xs font-black text-amber-700">{item.stock} un.</span></div><p className="mt-1 text-xs text-slate-500">Mínimo {item.min} • {item.location}</p></div>)}</div><Link href="/admin/estoque" className="mt-4 block text-center text-xs font-black text-amber-800">VER REPOSIÇÕES</Link></section>
      </div>
    </main>
  );
}
