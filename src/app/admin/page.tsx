"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type NotificationSummary = { counts?: { total?:number;critical?:number;high?:number;orders?:number;deliveries?:number;stock?:number;finance?:number } };

export default function AdminHome() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<NotificationSummary>({});

  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/orders", { cache: "no-store" }),
      fetch("/api/admin/products", { cache: "no-store" }),
      fetch("/api/admin/notifications", { cache: "no-store" }),
    ]).then(async ([ordersResponse, productsResponse, notificationsResponse]) => {
      if (ordersResponse.ok) setOrders((await ordersResponse.json()).orders ?? []);
      if (productsResponse.ok) setProducts((await productsResponse.json()).products ?? []);
      if (notificationsResponse.ok) setNotifications(await notificationsResponse.json());
    }).catch(() => undefined);
  }, []);

  const active = orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const sales = orders.filter((order) => order.status === "delivered").reduce((sum, order) => sum + Number(order.total), 0);
  const low = products.filter((product) => Number(product.stock) <= Number(product.minimumStock || 0));
  const pending = notifications.counts?.total ?? 0;
  const urgent = (notifications.counts?.critical ?? 0) + (notifications.counts?.high ?? 0);

  return <main className="p-4 md:p-6 lg:p-8">
    <div><p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">Operação em tempo real</p><h1 className="mt-1 text-3xl font-black text-[#1F2A44]">Visão geral</h1></div>

    {pending > 0 && <Link href="/admin/notificacoes" className={`mt-5 flex flex-col gap-3 rounded-[1.7rem] border p-4 transition md:flex-row md:items-center md:justify-between ${urgent ? "border-amber-200 bg-amber-50" : "border-[#E8DCC8] bg-white"}`}>
      <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#A88A45]">Pendências agora</p><p className="mt-1 text-lg font-black text-[#1F2A44]">🔔 {pending} {pending === 1 ? "item precisa" : "itens precisam"} de atenção</p><p className="mt-1 text-xs text-slate-500">{urgent ? `${urgent} com prioridade alta ou crítica.` : "Pendências operacionais sem urgência crítica."}</p></div>
      <span className="rounded-xl bg-[#1F2A44] px-4 py-3 text-center text-xs font-black text-white">ABRIR CENTRAL →</span>
    </Link>}

    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Pedidos ativos" value={String(active.length)} note="Recebidos até em entrega"/><StatCard label="Recebidos" value={String(orders.filter((order) => order.status === "received").length)} note="Aguardando separação"/><StatCard label="Estoque baixo" value={String(low.length)} note="Produtos no mínimo"/><StatCard label="Vendas entregues" value={brl.format(sales)} note="Pedidos carregados"/></section>

    <section className="mt-7 grid gap-5 lg:grid-cols-2"><div className="rounded-[2rem] border border-[#E8DCC8] bg-white p-5"><h2 className="font-black text-[#1F2A44]">Agora</h2><div className="mt-4 grid grid-cols-2 gap-3">{[["Recebidos","received"],["Separando","picking"],["Prontos","ready"],["Em entrega","out_for_delivery"]].map(([label,key])=><div key={key} className="rounded-2xl bg-[#F8F5EF] p-4"><p className="text-3xl font-black text-[#1F2A44]">{orders.filter((order) => order.status === key).length}</p><p className="text-xs font-bold text-slate-500">{label}</p></div>)}</div></div><div className="rounded-[2rem] border border-[#E8DCC8] bg-white p-5"><h2 className="font-black text-[#1F2A44]">Reposição</h2><div className="mt-4 space-y-3">{low.slice(0,6).map((product)=><div key={product.id} className="flex items-center justify-between rounded-2xl bg-[#F8F5EF] p-3"><span className="text-sm font-bold">{product.name}</span><span className="text-xs font-black text-amber-700">{product.stock} disponíveis</span></div>)}{!low.length&&<p className="text-sm text-slate-500">Nenhum produto abaixo do mínimo.</p>}</div></div></section>
  </main>;
}
