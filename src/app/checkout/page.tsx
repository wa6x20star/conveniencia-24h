"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StoreHeader } from "@/components/store-header";
import { useCart } from "@/components/cart-provider";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const delivery = 7;
const STORE_WHATSAPP = "5581995568320";
const LAST_ORDER_KEY = "conveniencia24h.lastOrder.v1";

type Payment = "pix" | "cash" | "card";

type CheckoutForm = {
  name: string;
  whatsapp: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  reference: string;
  notes: string;
  changeFor: string;
};

const initialForm: CheckoutForm = {
  name: "",
  whatsapp: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  reference: "",
  notes: "",
  changeFor: "",
};

const paymentLabels: Record<Payment, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  card: "Cartão na entrega",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const [payment, setPayment] = useState<Payment>("pix");
  const [form, setForm] = useState<CheckoutForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const total = subtotal + (items.length ? delivery : 0);

  const missingFields = useMemo(() => {
    const required = [form.name, form.whatsapp, form.cep, form.street, form.number, form.neighborhood];
    return required.some((value) => !value.trim());
  }, [form]);

  function updateField<K extends keyof CheckoutForm>(field: K, value: CheckoutForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function buildMessage(orderCode: string) {
    const itemLines = items
      .map((item) => `• ${item.qty}x ${item.name} — ${brl.format(item.price * item.qty)}`)
      .join("\n");

    const address = [
      `${form.street}, ${form.number}`,
      form.complement,
      form.neighborhood,
      `CEP ${form.cep}`,
    ].filter(Boolean).join(" • ");

    const extras = [
      form.reference ? `📍 Referência: ${form.reference}` : "",
      form.notes ? `📝 Observações: ${form.notes}` : "",
      payment === "cash" && form.changeFor ? `💵 Troco para: ${form.changeFor}` : "",
    ].filter(Boolean).join("\n");

    return [
      `🛍️ *NOVO PEDIDO — CONVENIÊNCIA 24H*`,
      `*Pedido #${orderCode}*`,
      "",
      `👤 *Cliente:* ${form.name}`,
      `📱 *WhatsApp:* ${form.whatsapp}`,
      `🏠 *Entrega:* ${address}`,
      extras,
      "",
      `📦 *Itens:*`,
      itemLines,
      "",
      `Subtotal: ${brl.format(subtotal)}`,
      `Entrega: ${brl.format(delivery)}`,
      `*TOTAL: ${brl.format(total)}*`,
      `💳 *Pagamento:* ${paymentLabels[payment]}`,
      "",
      `Pedido gerado pelo site da Conveniência 24h.`,
    ].filter(Boolean).join("\n");
  }

  function finishOrder() {
    if (!items.length || submitting) return;

    if (missingFields) {
      window.alert("Preencha nome, WhatsApp, CEP, rua, número e bairro antes de finalizar.");
      return;
    }

    setSubmitting(true);

    const orderCode = String(Date.now()).slice(-6);
    const message = buildMessage(orderCode);
    const whatsappUrl = `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(message)}`;

    const localOrder = {
      code: orderCode,
      createdAt: new Date().toISOString(),
      customer: form.name,
      customerWhatsapp: form.whatsapp,
      address: {
        cep: form.cep,
        street: form.street,
        number: form.number,
        complement: form.complement,
        neighborhood: form.neighborhood,
        reference: form.reference,
      },
      notes: form.notes,
      payment: paymentLabels[payment],
      changeFor: payment === "cash" ? form.changeFor : "",
      items,
      subtotal,
      delivery,
      total,
      whatsappUrl,
      status: "RECEBIDO",
    };

    localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(localOrder));

    const newWindow = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    clear();
    router.push(`/pedido/${orderCode}`);

    if (!newWindow) {
      window.location.href = whatsappUrl;
    }
  }

  if (!items.length) {
    return (
      <div className="min-h-screen bg-[#F8F5EF]">
        <StoreHeader />
        <main className="mx-auto max-w-xl px-4 py-14 text-center">
          <div className="text-6xl">🛒</div>
          <h1 className="mt-5 text-3xl font-black text-[#1F2A44]">Nenhum item para finalizar</h1>
          <p className="mt-2 text-sm text-slate-500">Adicione produtos ao carrinho antes de abrir o checkout.</p>
          <Link href="/" className="mt-6 inline-flex rounded-2xl bg-[#1F2A44] px-5 py-3 text-xs font-black text-white">VOLTAR À LOJA</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5EF]">
      <StoreHeader />
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">Último passo</p>
          <h1 className="mt-1 text-3xl font-black text-[#1F2A44]">Finalizar pedido</h1>
          <p className="mt-2 text-sm text-slate-500">Ao finalizar, o WhatsApp abrirá com o pedido pronto para envio à loja.</p>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <section className="rounded-[2rem] border border-[#E8DCC8] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#1F2A44] text-sm font-black text-white">1</span><h2 className="font-black text-[#1F2A44]">Seus dados</h2></div>
            <div className="space-y-3">
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} className="h-12 w-full rounded-2xl border border-[#E8DCC8] px-4 outline-none focus:border-[#C6A75E]" placeholder="Nome completo *" />
              <input value={form.whatsapp} onChange={(event) => updateField("whatsapp", event.target.value)} className="h-12 w-full rounded-2xl border border-[#E8DCC8] px-4 outline-none focus:border-[#C6A75E]" placeholder="WhatsApp *" inputMode="tel" />
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#E8DCC8] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#1F2A44] text-sm font-black text-white">2</span><h2 className="font-black text-[#1F2A44]">Entrega</h2></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.cep} onChange={(event) => updateField("cep", event.target.value)} className="h-12 rounded-2xl border border-[#E8DCC8] px-4 sm:col-span-2" placeholder="CEP *" inputMode="numeric" />
              <input value={form.street} onChange={(event) => updateField("street", event.target.value)} className="h-12 rounded-2xl border border-[#E8DCC8] px-4 sm:col-span-2" placeholder="Rua *" />
              <input value={form.number} onChange={(event) => updateField("number", event.target.value)} className="h-12 rounded-2xl border border-[#E8DCC8] px-4" placeholder="Número *" />
              <input value={form.complement} onChange={(event) => updateField("complement", event.target.value)} className="h-12 rounded-2xl border border-[#E8DCC8] px-4" placeholder="Complemento" />
              <input value={form.neighborhood} onChange={(event) => updateField("neighborhood", event.target.value)} className="h-12 rounded-2xl border border-[#E8DCC8] px-4 sm:col-span-2" placeholder="Bairro *" />
              <input value={form.reference} onChange={(event) => updateField("reference", event.target.value)} className="h-12 rounded-2xl border border-[#E8DCC8] px-4 sm:col-span-2" placeholder="Ponto de referência" />
              <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} className="min-h-24 rounded-2xl border border-[#E8DCC8] p-4 sm:col-span-2" placeholder="Observações do pedido (opcional)" />
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#E8DCC8] bg-white p-5 shadow-sm md:col-span-2">
            <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#1F2A44] text-sm font-black text-white">3</span><h2 className="font-black text-[#1F2A44]">Pagamento</h2></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <button type="button" onClick={() => setPayment("pix")} className={`rounded-2xl border-2 p-4 text-left ${payment === "pix" ? "border-[#C6A75E] bg-[#F7F2E9]" : "border-[#E8DCC8]"}`}><span className="text-2xl">◈</span><p className="mt-2 font-black text-[#1F2A44]">PIX</p><p className="text-xs text-slate-500">Pedido informa PIX à loja</p></button>
              <button type="button" onClick={() => setPayment("cash")} className={`rounded-2xl border-2 p-4 text-left ${payment === "cash" ? "border-[#C6A75E] bg-[#F7F2E9]" : "border-[#E8DCC8]"}`}><span className="text-2xl">💵</span><p className="mt-2 font-black text-[#1F2A44]">Dinheiro</p><p className="text-xs text-slate-500">Troco vai junto no pedido</p></button>
              <button type="button" onClick={() => setPayment("card")} className={`rounded-2xl border-2 p-4 text-left ${payment === "card" ? "border-[#C6A75E] bg-[#F7F2E9]" : "border-[#E8DCC8]"}`}><span className="text-2xl">💳</span><p className="mt-2 font-black text-[#1F2A44]">Cartão</p><p className="text-xs text-slate-500">Pagamento na entrega</p></button>
            </div>
            {payment === "cash" && <input value={form.changeFor} onChange={(event) => updateField("changeFor", event.target.value)} className="mt-3 h-12 w-full rounded-2xl border border-[#E8DCC8] px-4" placeholder="Troco para quanto? (opcional)" inputMode="decimal" />}
          </section>
        </div>

        <section className="mt-5 rounded-[2rem] bg-[#1F2A44] p-5 text-white md:flex md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[#E8DCC8]">Total do pedido</p>
            <p className="mt-1 text-3xl font-black">{brl.format(total)}</p>
            <p className="mt-1 text-xs text-[#B9B2A8]">Inclui {brl.format(delivery)} de entrega demonstrativa</p>
          </div>
          <button onClick={finishOrder} disabled={submitting} className="mt-4 h-14 w-full rounded-2xl bg-[#C6A75E] px-6 text-sm font-black text-[#1F2A44] disabled:opacity-60 md:mt-0 md:w-auto">
            {submitting ? "ABRINDO WHATSAPP..." : `ENVIAR NO WHATSAPP • ${brl.format(total)}`}
          </button>
        </section>

        <p className="mt-3 text-center text-[11px] font-semibold text-[#8B8277]">O WhatsApp abrirá com a mensagem preenchida. O cliente confirma o envio no aplicativo.</p>
      </main>
    </div>
  );
}
