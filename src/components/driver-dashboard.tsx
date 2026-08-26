"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const payment: Record<string, string> = { pix: "PIX", cash: "Dinheiro", card_on_delivery: "Cartão na entrega" };
const paymentStatus: Record<string, string> = { paid: "PAGO", on_delivery: "RECEBER NA ENTREGA", pending: "PENDENTE", failed: "FALHOU", cancelled: "CANCELADO" };
const payoutMethod: Record<string, string> = { pix: "PIX", cash: "Dinheiro", transfer: "Transferência" };

type DriverStats = { deliveries: number; payout: number; distanceKm: number; averagePayout: number };
type HistoryItem = { id: string; orderNumber: number | null; neighborhood: string | null; city: string | null; distanceKm: number; payout: number; deliveredAt: string; payoutStatus?: "paid" | "pending" | "untracked" };
type FinancialPayout = { id: string; payoutNumber: string; amount: number; paymentMethod: string; paidAt: string; deliveries: number; proofUrl?: string | null };
type DriverFinancial = { enabled: boolean; controlStartedAt: string | null; pendingAmount: number; pendingDeliveries: number; receivedThisMonth: number; recentPayouts: FinancialPayout[] };

type DriverData = {
  driver?: { id: string; status: "available" | "delivering" | "offline"; profile?: { full_name?: string; phone?: string } | null };
  delivery?: any;
  stats?: { today: DriverStats; week: DriverStats; month: DriverStats };
  history?: HistoryItem[];
  financial?: DriverFinancial;
  generatedAt?: string;
};

function normalizeWhatsapp(phone?: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(status?: string) {
  if (status === "available") return "bg-emerald-100 text-emerald-800";
  if (status === "delivering") return "bg-amber-300 text-[#1F2A44]";
  return "bg-slate-600 text-white";
}

function statusLabel(status?: string) {
  if (status === "available") return "DISPONÍVEL";
  if (status === "delivering") return "EM ENTREGA";
  return "OFFLINE";
}

function SummaryCard({ title, stats }: { title: string; stats?: DriverStats }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <p className="text-[10px] font-black uppercase tracking-wider text-[#C6A75E]">{title}</p>
    <p className="mt-1 text-xl font-black">{brl.format(Number(stats?.payout || 0))}</p>
    <p className="mt-1 text-xs text-slate-300">{stats?.deliveries || 0} entregas • {Number(stats?.distanceKm || 0).toFixed(1)} km</p>
  </div>;
}

export function DriverDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/driver/deliveries", { cache: "no-store" });
      if (r.status === 401) {
        router.replace("/entregador/login");
        return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao carregar");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      if (silent) setRefreshing(false); else setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function action(name: string, deliveryId?: string) {
    if (name === "delivered" && !window.confirm("Confirmar que o pedido foi entregue ao cliente?")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/driver/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: name, deliveryId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível atualizar");
      await load(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/entregador/login");
    router.refresh();
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#1F2A44] text-sm font-bold text-white">Carregando seu painel...</div>;
  if (error && !data) return <div className="grid min-h-screen place-items-center bg-[#1F2A44] p-4 text-white"><div className="max-w-md rounded-3xl bg-white p-6 text-[#1F2A44]"><h1 className="text-xl font-black">Não foi possível abrir o painel</h1><p className="mt-2 text-sm text-slate-500">{error}</p><button onClick={() => load()} className="mt-4 min-h-11 rounded-2xl bg-[#C6A75E] px-4 py-3 text-xs font-black">TENTAR NOVAMENTE</button></div></div>;

  const driver = data?.driver;
  const delivery = data?.delivery;
  const name = driver?.profile?.full_name || "Entregador";
  const firstName = name.trim().split(/\s+/)[0] || "Entregador";
  const phone = delivery?.order?.customer_phone || "";
  const whatsapp = normalizeWhatsapp(phone);
  const address = [delivery?.order?.street, delivery?.order?.number, delivery?.order?.neighborhood, delivery?.order?.city, delivery?.order?.state, delivery?.order?.postal_code].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const wazeUrl = `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
  const requiresCollection = delivery?.order?.payment_status === "on_delivery";
  const pStatus = paymentStatus[String(delivery?.order?.payment_status || "")] || String(delivery?.order?.payment_status || "PENDENTE").toUpperCase();

  return <div className="min-h-screen bg-[#1F2A44] px-4 py-5 text-white">
    <main className="mx-auto max-w-xl pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#C6A75E]">Painel do entregador</p>
          <h1 className="mt-1 text-2xl font-black">Olá, {firstName} 👋</h1>
          <p className="mt-1 text-xs text-slate-400">Atualização automática a cada 30 segundos</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={`rounded-full px-3 py-2 text-[10px] font-black ${statusClass(driver?.status)}`}>{statusLabel(driver?.status)}</span>
          <button disabled={refreshing} onClick={() => load(true)} className="min-h-10 rounded-xl border border-white/15 px-3 text-[10px] font-black disabled:opacity-50">{refreshing ? "ATUALIZANDO..." : "ATUALIZAR"}</button>
          <button onClick={logout} className="min-h-10 rounded-xl border border-white/15 px-3 text-[10px] font-black">SAIR</button>
        </div>
      </header>

      {error && <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</div>}

      <section className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <SummaryCard title="Hoje" stats={data?.stats?.today}/>
        <SummaryCard title="Esta semana" stats={data?.stats?.week}/>
        <SummaryCard title="Este mês" stats={data?.stats?.month}/>
      </section>
      <p className="mt-2 text-[11px] text-slate-400">Produção registrada nas entregas concluídas. O que já foi pago aparece no Financeiro abaixo.</p>

      <FinancialPanel financial={data?.financial}/>

      {!delivery ? <section className="mt-6 rounded-[2rem] bg-white p-6 text-center text-[#1F2A44]">
        <div className="text-5xl">🛵</div>
        <h2 className="mt-4 text-2xl font-black">Nenhuma entrega atribuída</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Quando a operação atribuir um pedido a você, ele aparecerá automaticamente aqui com contato, endereço e rota.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button disabled={busy || driver?.status === "available"} onClick={() => action("available")} className="min-h-12 rounded-2xl bg-[#C6A75E] p-3 text-xs font-black disabled:opacity-40">FICAR DISPONÍVEL</button>
          <button disabled={busy || driver?.status === "offline"} onClick={() => action("offline")} className="min-h-12 rounded-2xl bg-[#F4ECDF] p-3 text-xs font-black disabled:opacity-40">FICAR OFFLINE</button>
        </div>
      </section> : <section className="mt-6 rounded-[2rem] bg-white p-5 text-[#1F2A44]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-[#1F2A44] px-3 py-1.5 text-xs font-black text-white">#{String(delivery.order?.order_number ?? "").padStart(6, "0")}</span>
          <span className="text-xs font-bold text-slate-400">{delivery.distance_km != null ? `${Number(delivery.distance_km).toFixed(1)} km` : "distância não calculada"}</span>
        </div>

        <div className={`mt-4 rounded-2xl p-4 ${requiresCollection ? "bg-amber-50 text-amber-900" : delivery.order?.payment_status === "paid" ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-700"}`}>
          <p className="text-[10px] font-black uppercase tracking-wider">Pagamento</p>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <strong className="text-base">{payment[delivery.order?.payment_method] || delivery.order?.payment_method}</strong>
            <strong className="text-xs">{pStatus}</strong>
          </div>
          {requiresCollection && <p className="mt-2 text-sm font-black">Receber do cliente: {brl.format(Number(delivery.order?.total || 0))}</p>}
          {delivery.order?.payment_status === "paid" && <p className="mt-2 text-xs font-bold">Pagamento já confirmado. Não cobrar novamente.</p>}
        </div>

        <h2 className="mt-5 text-2xl font-black">{delivery.order?.customer_name}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{delivery.order?.street}, {delivery.order?.number}{delivery.order?.complement ? ` - ${delivery.order.complement}` : ""} • {delivery.order?.neighborhood}<br/>{delivery.order?.city}/{delivery.order?.state} • CEP {delivery.order?.postal_code}{delivery.order?.address_reference && <><br/><strong>Referência:</strong> {delivery.order.address_reference}</>}</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <a href={`tel:${phone}`} className="grid min-h-12 place-items-center rounded-2xl bg-[#F4ECDF] p-3 text-center text-xs font-black">📞 LIGAR</a>
          <a href={whatsapp ? `https://wa.me/${whatsapp}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!whatsapp} className={`grid min-h-12 place-items-center rounded-2xl p-3 text-center text-xs font-black ${whatsapp ? "bg-[#F4ECDF]" : "pointer-events-none bg-slate-100 text-slate-400"}`}>💬 WHATSAPP</a>
          <a target="_blank" rel="noreferrer" href={mapsUrl} className="grid min-h-12 place-items-center rounded-2xl bg-[#F4ECDF] p-3 text-center text-xs font-black">🗺️ GOOGLE MAPS</a>
          <a target="_blank" rel="noreferrer" href={wazeUrl} className="grid min-h-12 place-items-center rounded-2xl bg-[#F4ECDF] p-3 text-center text-xs font-black">🚗 WAZE</a>
        </div>

        <div className="my-5 border-t border-dashed border-[#E8DCC8]"/>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-3"><span className="text-slate-500">Valor do pedido</span><strong>{brl.format(Number(delivery.order?.total || 0))}</strong></div>
          <div className="flex justify-between gap-3"><span className="text-slate-500">Sua entrega</span><strong className="text-emerald-700">{brl.format(Number(delivery.driver_payout || 0))}</strong></div>
          <div className="flex justify-between gap-3"><span className="text-slate-500">Situação</span><strong>{delivery.status === "started" ? "EM ROTA" : "ATRIBUÍDA"}</strong></div>
        </div>

        {delivery.items?.length > 0 && <div className="mt-5 rounded-2xl bg-[#F8F5EF] p-4"><p className="text-xs font-black uppercase text-[#A88A45]">Itens do pedido</p><ul className="mt-2 space-y-1 text-sm">{delivery.items.map((item: any, index: number) => <li key={index}>{item.quantity}x {item.product_name}</li>)}</ul></div>}
        {delivery.order?.notes && <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm"><strong>Observação:</strong> {delivery.order.notes}</div>}

        {delivery.status === "assigned"
          ? <button disabled={busy} onClick={() => action("start", delivery.id)} className="mt-6 min-h-14 w-full rounded-2xl bg-[#C6A75E] text-sm font-black text-[#1F2A44] disabled:opacity-50">INICIAR ENTREGA</button>
          : <button disabled={busy} onClick={() => action("delivered", delivery.id)} className="mt-6 min-h-14 w-full rounded-2xl bg-emerald-500 text-sm font-black text-white disabled:opacity-50">CONFIRMAR ENTREGA</button>}
      </section>}

      <HistoryPanel history={data?.history || []} stats={data?.stats?.month}/>

      <p className="mt-5 text-center text-xs text-slate-400">Você visualiza somente informações vinculadas às entregas da sua conta.</p>
    </main>
  </div>;
}

function FinancialPanel({ financial }: { financial?: DriverFinancial }) {
  const [open, setOpen] = useState(false);
  if (!financial?.enabled) return <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/5 p-5"><p className="text-xs font-black uppercase tracking-wider text-[#C6A75E]">Financeiro</p><p className="mt-2 text-sm text-slate-300">O controle de repasses será exibido aqui quando a V6.8 estiver ativada.</p></section>;

  return <section className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5">
    <div className="p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-[#C6A75E]">Financeiro</p><h2 className="mt-1 text-lg font-black">Seus repasses</h2></div><span className={`rounded-full px-3 py-1 text-[10px] font-black ${financial.pendingDeliveries ? "bg-amber-300 text-[#1F2A44]" : "bg-emerald-100 text-emerald-800"}`}>{financial.pendingDeliveries ? "PENDENTE" : "EM DIA"}</span></div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white/5 p-4"><p className="text-[10px] font-black uppercase text-slate-400">A receber</p><p className="mt-1 text-xl font-black text-amber-200">{brl.format(Number(financial.pendingAmount || 0))}</p><p className="mt-1 text-xs text-slate-400">{financial.pendingDeliveries || 0} entregas</p></div>
        <div className="rounded-2xl bg-white/5 p-4"><p className="text-[10px] font-black uppercase text-slate-400">Recebido no mês</p><p className="mt-1 text-xl font-black text-emerald-200">{brl.format(Number(financial.receivedThisMonth || 0))}</p><p className="mt-1 text-xs text-slate-400">Repasses confirmados</p></div>
      </div>
      {financial.controlStartedAt && <p className="mt-3 text-[10px] text-slate-500">Controle financeiro ativo desde {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(financial.controlStartedAt))}.</p>}
    </div>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-h-14 w-full items-center justify-between border-t border-white/10 px-5 text-left text-xs font-black"><span>ÚLTIMOS REPASSES</span><span className="text-lg">{open ? "−" : "+"}</span></button>
    {open && <div className="border-t border-white/10 p-4">
      <div className="space-y-2">{financial.recentPayouts?.length ? financial.recentPayouts.map((payout) => <div key={payout.id} className="rounded-2xl border border-white/10 p-3">
        <div className="flex items-center justify-between gap-3"><div><p className="font-black">{payout.payoutNumber}</p><p className="text-xs text-slate-400">{formatDate(payout.paidAt)} • {payoutMethod[payout.paymentMethod] || payout.paymentMethod} • {payout.deliveries} entregas</p></div><strong className="text-emerald-200">{brl.format(payout.amount)}</strong></div>
        {payout.proofUrl && <a href={payout.proofUrl} target="_blank" rel="noreferrer" className="mt-3 grid min-h-10 place-items-center rounded-xl border border-white/10 text-[10px] font-black text-[#E8DCC8]">VER COMPROVANTE</a>}
      </div>) : <p className="rounded-2xl border border-white/10 p-4 text-center text-sm text-slate-400">Nenhum repasse registrado ainda.</p>}</div>
    </div>}
  </section>;
}

function HistoryPanel({ history, stats }: { history: HistoryItem[]; stats?: DriverStats }) {
  const [open, setOpen] = useState(false);
  const average = useMemo(() => Number(stats?.averagePayout || 0), [stats?.averagePayout]);

  return <section className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-4 text-left">
      <div><p className="text-xs font-black uppercase tracking-wider text-[#C6A75E]">Histórico e desempenho</p><p className="mt-1 text-sm text-slate-300">Últimas entregas concluídas</p></div>
      <span className="text-xl" aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    {open && <div className="border-t border-white/10 p-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white/5 p-3"><p className="text-[10px] text-slate-400">Entregas/mês</p><strong className="mt-1 block">{stats?.deliveries || 0}</strong></div>
        <div className="rounded-2xl bg-white/5 p-3"><p className="text-[10px] text-slate-400">Km/mês</p><strong className="mt-1 block">{Number(stats?.distanceKm || 0).toFixed(1)}</strong></div>
        <div className="rounded-2xl bg-white/5 p-3"><p className="text-[10px] text-slate-400">Média/entrega</p><strong className="mt-1 block">{brl.format(average)}</strong></div>
      </div>
      <div className="mt-4 space-y-2">
        {history.length ? history.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 p-3">
          <div className="min-w-0"><p className="font-black">{item.orderNumber != null ? `#${String(item.orderNumber).padStart(6, "0")}` : "Pedido"}</p><p className="truncate text-xs text-slate-400">{formatDate(item.deliveredAt)} • {[item.neighborhood, item.city].filter(Boolean).join(" • ") || "Entrega concluída"}</p></div>
          <div className="shrink-0 text-right"><p className="font-black text-[#E8DCC8]">{brl.format(item.payout)}</p><p className="text-[10px] text-slate-400">{item.distanceKm.toFixed(1)} km</p><p className={`mt-1 text-[9px] font-black ${item.payoutStatus === "paid" ? "text-emerald-300" : item.payoutStatus === "pending" ? "text-amber-300" : "text-slate-500"}`}>{item.payoutStatus === "paid" ? "PAGO" : item.payoutStatus === "pending" ? "A RECEBER" : "FORA DO CONTROLE"}</p></div>
        </div>) : <p className="rounded-2xl border border-white/10 p-4 text-center text-sm text-slate-400">Seu histórico aparecerá aqui após a primeira entrega concluída.</p>}
      </div>
    </div>}
  </section>;
}
