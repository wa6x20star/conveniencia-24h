"use client";

import { OrderCancellation, type CancellationOrder } from "@/components/order-cancellation";
import { useCallback, useEffect, useMemo, useState } from "react";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const columns = [
  { key: "received", label: "RECEBIDO" },
  { key: "picking", label: "SEPARANDO" },
  { key: "ready", label: "PRONTO" },
  { key: "out_for_delivery", label: "EM ENTREGA" },
  { key: "delivered", label: "ENTREGUE" },
] as const;

const nextStatus: Record<string, { status: string; label: string } | undefined> = {
  received: { status: "picking", label: "INICIAR SEPARAÇÃO" },
  picking: { status: "ready", label: "MARCAR COMO PRONTO" },
};

type Order = CancellationOrder & {
  id: string; order_number: number; tracking_token: string; status: string; payment_method: string; payment_status: string;
  total: number; customer_name: string; customer_phone: string; neighborhood: string; street: string; number: string;
  created_at: string; itemCount: number; items: { product_name: string; quantity: number }[];
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 503 ? "Supabase ainda não configurado." : "Não foi possível carregar os pedidos.");
      const data = await response.json();
      setOrders(data.orders ?? []);
      setRole(data.role || "");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  async function changeStatus(order: Order, status: string) {
    setBusy(order.id);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao alterar status");
      await load();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Falha ao alterar status");
    } finally {
      setBusy(null);
    }
  }

  const cancelled = useMemo(() => orders.filter((order) => order.status === "cancelled"), [orders]);

  return <main className="p-4 md:p-6 lg:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">Fluxo vivo</p><h1 className="mt-1 text-3xl font-black text-[#1F2A44]">Central de pedidos</h1><p className="mt-1 text-sm text-slate-500">Os pedidos reais aparecem aqui e atualizam automaticamente.</p></div><button onClick={()=>void load()} className="rounded-xl border border-[#E8DCC8] bg-white px-4 py-2.5 text-xs font-black text-[#1F2A44]">ATUALIZAR</button></div>{message && <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">{message}</div>}{loading ? <div className="mt-8 text-sm font-bold text-slate-500">Carregando pedidos...</div> : <section className="mt-6 grid gap-4 2xl:grid-cols-5 xl:grid-cols-3 md:grid-cols-2">{columns.map((column) => { const list=orders.filter((o)=>o.status===column.key); return <div key={column.key} className="min-h-72 rounded-[2rem] bg-[#E8DCC8]/65 p-3"><div className="flex items-center justify-between px-2 py-2"><h2 className="text-xs font-black tracking-wider text-[#1F2A44]">{column.label}</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-black">{list.length}</span></div><div className="mt-1 space-y-3">{list.map((order)=><article key={order.id} className="rounded-3xl bg-white p-4 shadow-sm"><div className="flex justify-between gap-3"><p className="text-sm font-black text-[#1F2A44]">#{String(order.order_number).padStart(6,"0")}</p><span className="text-xs font-bold text-slate-400">{new Date(order.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span></div><p className="mt-2 truncate text-sm font-semibold">{order.customer_name}</p><p className="mt-1 text-xs text-slate-400">{order.itemCount} itens • {order.payment_method.toUpperCase()}</p><p className="mt-1 text-xs text-slate-500">{order.neighborhood} • {order.street}, {order.number}</p><div className="mt-3 rounded-xl bg-[#F8F5EF] p-2.5 text-[11px] text-slate-600">{order.items.slice(0,4).map((item,i)=><div key={i}>{item.quantity}x {item.product_name}</div>)}{order.items.length>4 && <div>+ {order.items.length-4} itens</div>}</div><p className="mt-3 text-lg font-black text-[#1F2A44]">{brl.format(Number(order.total))}</p><a href={`https://wa.me/55${order.customer_phone.replace(/\D/g,"").replace(/^55/,"")}`} target="_blank" rel="noreferrer" className="mt-3 block text-center text-[10px] font-black text-[#168A3F]">ABRIR WHATSAPP DO CLIENTE</a>{nextStatus[column.key] && <button disabled={busy===order.id} onClick={()=>void changeStatus(order,nextStatus[column.key]!.status)} className="mt-2 w-full rounded-xl bg-[#1F2A44] px-3 py-2.5 text-[11px] font-black text-white disabled:opacity-50">{busy===order.id?"ATUALIZANDO...":nextStatus[column.key]!.label}</button>}{column.key==="ready" && <a href="/admin/entregas" className="mt-2 block w-full rounded-xl bg-[#C6A75E] px-3 py-2.5 text-center text-[11px] font-black text-[#1F2A44]">ATRIBUIR ENTREGADOR</a>}{column.key==="out_for_delivery" && <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2.5 text-center text-[10px] font-black text-amber-800">AGUARDANDO CONFIRMAÇÃO DO ENTREGADOR</div>}<OrderCancellation order={order} onChanged={load} /><a href={`/pedido/${order.tracking_token}`} target="_blank" className="mt-2 block text-center text-[10px] font-bold text-slate-400">VER ACOMPANHAMENTO</a></article>)}</div></div>})}</section>}{cancelled.length>0 && <section id="cancelados" className="mt-7"><h2 className="text-sm font-black text-[#1F2A44]">Cancelados e estornos ({cancelled.length})</h2><div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[...cancelled].sort((a,b)=>Number(b.refund_status==="pending")-Number(a.refund_status==="pending")).map(order=><article key={order.id} className="rounded-2xl border border-red-100 bg-white p-4"><h3 className="text-sm font-black">#{String(order.order_number).padStart(6,"0")} • {order.customer_name}</h3><p className="mt-1 text-xs">{order.payment_method.toUpperCase()} · {brl.format(Number(order.total))}</p><OrderCancellation order={order} canRefund={role==="admin"} onChanged={load} /><a href={`/pedido/${order.tracking_token}`} target="_blank" rel="noreferrer" className="mt-3 block text-xs font-bold">Ver acompanhamento</a></article>)}</div></section>}</main>;
}
