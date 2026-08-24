"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { DeliveryIcon, PackageIcon, ShieldIcon } from "@/components/brand-icons";
import { STORE_WHATSAPP } from "@/lib/config";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const LAST_ORDER_KEY = "conveniencia24h.lastOrder.v2";
const steps = [["received","Pedido recebido"],["picking","Em separação"],["ready","Pedido pronto"],["out_for_delivery","Saiu para entrega"],["delivered","Entregue"]] as const;
const paymentLabels: Record<string,string> = { pix:"PIX", cash:"Dinheiro", card_on_delivery:"Cartão na entrega" };

type Order = { order_number:number; status:string; payment_method:string; payment_status:string; subtotal:number; delivery_fee:number; total:number; customer_name:string; items:{id:string;product_name:string;quantity:number;unit_price:number;total_price:number}[]; history:{status:string;created_at:string}[]; cancellation_reason?:string };

export default function TrackingPage() {
  const params = useParams<{ token: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [local, setLocal] = useState<any>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${params.token}`, { cache: "no-store" });
      if (!response.ok) throw new Error("not_remote");
      const data = await response.json();
      setOrder(data.order);
      setMessage("");
    } catch {
      try {
        const stored = localStorage.getItem(LAST_ORDER_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setLocal(parsed);
          if (parsed.fallback) setMessage("Este pedido foi enviado somente pelo WhatsApp porque o banco ainda não estava conectado.");
        }
      } catch {}
    }
  }, [params.token]);

  useEffect(() => { void load(); const timer = setInterval(() => void load(), 8000); return () => clearInterval(timer); }, [load]);
  const currentIndex = useMemo(() => order ? steps.findIndex(([key]) => key === order.status) : -1, [order]);

  if (!order && local?.fallback) {
    return <div className="brand-grid min-h-screen bg-[#1F2A44] px-4 py-7 text-white"><main className="mx-auto max-w-xl"><BrandLogo inverted tagline /><div className="mt-8 rounded-[2rem] bg-[#fffdf9] p-6 text-[#1F2A44] shadow-2xl"><span className="rounded-full bg-[#FFF3D6] px-3 py-1 text-[10px] font-extrabold text-[#7A5A1D]">PEDIDO WHATSAPP #{local.code}</span><h1 className="mt-4 text-3xl font-extrabold tracking-[-.03em]">Pedido encaminhado à loja.</h1><p className="mt-2 text-sm text-[#777066]">{message}</p><a href={local.whatsappUrl} target="_blank" className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-[#25D366] text-sm font-extrabold text-[#113A20]">ABRIR WHATSAPP</a></div></main></div>;
  }

  return (
    <div className="brand-grid min-h-screen bg-[#1F2A44] px-4 py-7 text-white">
      <main className="mx-auto max-w-xl">
        <div className="flex items-center justify-between"><BrandLogo inverted tagline /><Link href="/" className="text-[10px] font-extrabold uppercase tracking-wide text-[#E8DCC8] hover:text-[#C6A75E]">Voltar à loja</Link></div>
        <div className="mt-8 rounded-[2rem] bg-[#fffdf9] p-6 text-[#1F2A44] shadow-[0_30px_80px_rgba(0,0,0,.3)]">
          {order ? <>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-[#E8DCC8] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide">Pedido #{String(order.order_number).padStart(6,"0")}</span><span className="text-[9px] font-bold text-[#8D8376]">Atualiza automaticamente</span></div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-[-.035em]">Acompanhe seu pedido.</h1>
            <p className="mt-2 text-sm text-[#777066]">Você acompanha cada etapa sem precisar perguntar pelo WhatsApp.</p>

            {order.status === "cancelled" ? <div className="mt-5 rounded-2xl bg-red-50 p-4 font-bold text-red-700">Pedido cancelado. {order.cancellation_reason || ""}</div> : (
              <div className="mt-7">
                {steps.map(([key,label],index) => { const done = currentIndex >= index; const active = currentIndex === index; return <div key={key} className="grid grid-cols-[40px_1fr] gap-3"><div className="flex flex-col items-center"><span className={`grid size-9 place-items-center rounded-full text-xs font-extrabold ${done ? "bg-[#C6A75E] text-[#1F2A44]" : "bg-[#F4ECDF] text-[#9C9286]"} ${active ? "ring-4 ring-[#C6A75E]/20" : ""}`}>{done ? "✓" : index + 1}</span>{index < steps.length - 1 && <span className={`h-10 w-0.5 ${currentIndex > index ? "bg-[#C6A75E]" : "bg-[#EFE5D6]"}`} />}</div><div className="pt-1.5"><p className={`font-display text-sm font-bold ${done ? "text-[#1F2A44]" : "text-[#9A9186]"}`}>{label}</p>{active && <p className="mt-0.5 text-[10px] font-semibold text-[#A88A45]">Etapa atual</p>}</div></div>; })}
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#F4ECDF] p-3"><PackageIcon className="size-5 text-[#A88A45]"/><p className="mt-2 text-[9px] font-extrabold uppercase text-[#8E8375]">Cliente</p><strong className="text-sm">{order.customer_name}</strong></div>
              <div className="rounded-2xl bg-[#F4ECDF] p-3"><ShieldIcon className="size-5 text-[#A88A45]"/><p className="mt-2 text-[9px] font-extrabold uppercase text-[#8E8375]">Pagamento</p><strong className="text-sm">{paymentLabels[order.payment_method] || order.payment_method}</strong></div>
              <div className="rounded-2xl bg-[#F4ECDF] p-3"><DeliveryIcon className="size-5 text-[#A88A45]"/><p className="mt-2 text-[9px] font-extrabold uppercase text-[#8E8375]">Total</p><strong className="text-sm">{brl.format(Number(order.total))}</strong></div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#E8DCC8] p-4"><p className="brand-eyebrow">Itens do pedido</p><div className="mt-3 space-y-2">{order.items.map(item => <div key={item.id} className="flex justify-between gap-4 text-sm"><span>{item.quantity}x {item.product_name}</span><strong>{brl.format(Number(item.total_price))}</strong></div>)}</div></div>
            <a href={`https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre o pedido #${String(order.order_number).padStart(6,"0")}.`)}`} target="_blank" className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-[#25D366] text-sm font-extrabold text-[#113A20]">FALAR COM A LOJA</a>
          </> : <><PackageIcon className="size-12 text-[#C6A75E]"/><h1 className="mt-4 text-3xl font-extrabold">Carregando pedido...</h1><p className="mt-2 text-sm text-[#777066]">Se o pedido acabou de ser criado, aguarde alguns segundos.</p></>}
        </div>
      </main>
    </div>
  );
}
