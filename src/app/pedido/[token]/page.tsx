"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const LAST_ORDER_KEY = "conveniencia24h.lastOrder.v1";

type StoredOrder = {
  code: string;
  createdAt: string;
  customer: string;
  customerWhatsapp: string;
  address: {
    cep: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    reference: string;
  };
  notes: string;
  payment: string;
  changeFor: string;
  items: Array<{ id: number; name: string; price: number; qty: number }>;
  subtotal: number;
  delivery: number;
  total: number;
  whatsappUrl: string;
  status: string;
};

const demoSteps = [
  { label: "Pedido enviado pelo WhatsApp", done: true },
  { label: "Aguardando confirmação da loja", done: false },
  { label: "Separando", done: false },
  { label: "Saiu para entrega", done: false },
  { label: "Entregue", done: false },
];

export default function TrackingPage() {
  const [order, setOrder] = useState<StoredOrder | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_ORDER_KEY);
      if (stored) setOrder(JSON.parse(stored));
    } catch {
      localStorage.removeItem(LAST_ORDER_KEY);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#1F2A44] px-4 py-8 text-white">
      <main className="mx-auto max-w-xl">
        <Link href="/" className="text-sm font-bold text-[#E8DCC8]">← Voltar para a loja</Link>
        <div className="mt-5 rounded-[2rem] bg-white p-6 text-[#1F2A44] shadow-2xl">
          <span className="rounded-full bg-[#E8DCC8] px-3 py-1 text-xs font-black text-[#1F2A44]">PEDIDO #{order?.code ?? "DEMO"}</span>
          <h1 className="mt-4 text-3xl font-black">Pedido encaminhado para a loja. 📲</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">O WhatsApp foi aberto com todos os dados do pedido. Após a confirmação da loja, o acompanhamento automático entrará na próxima fase com o Supabase.</p>

          <div className="mt-7 space-y-0">
            {demoSteps.map((step, index) => (
              <div key={step.label} className="grid grid-cols-[36px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className={`grid size-8 place-items-center rounded-full text-xs font-black ${step.done ? "bg-[#C6A75E] text-[#1F2A44]" : "bg-[#F4ECDF] text-slate-400"}`}>{step.done ? "✓" : index + 1}</span>
                  {index < demoSteps.length - 1 && <span className={`h-10 w-0.5 ${step.done ? "bg-[#D6BB78]" : "bg-[#F4ECDF]"}`} />}
                </div>
                <p className={`pt-1.5 text-sm font-black ${step.done ? "text-[#1F2A44]" : "text-slate-400"}`}>{step.label}</p>
              </div>
            ))}
          </div>

          {order && (
            <>
              <div className="mt-6 rounded-2xl bg-[#F4ECDF] p-4">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Cliente</span><strong>{order.customer}</strong></div>
                <div className="mt-2 flex justify-between text-sm"><span className="text-slate-500">Total</span><strong>{brl.format(order.total)}</strong></div>
                <div className="mt-2 flex justify-between text-sm"><span className="text-slate-500">Pagamento</span><strong className="text-[#A88A45]">{order.payment}</strong></div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#E8DCC8] p-4">
                <p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">Itens</p>
                <div className="mt-3 space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 text-sm">
                      <span>{item.qty}x {item.name}</span>
                      <strong>{brl.format(item.price * item.qty)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <a href={order.whatsappUrl} target="_blank" rel="noreferrer" className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-[#25D366] text-sm font-black text-[#113A20]">ABRIR PEDIDO NO WHATSAPP</a>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
