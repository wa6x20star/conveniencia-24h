"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const methodLabel: Record<string, string> = { pix: "PIX", cash: "Dinheiro", transfer: "Transferência" };

type PendingDelivery = {
  id: string;
  orderNumber: number | null;
  neighborhood: string | null;
  city: string | null;
  deliveredAt: string;
  distanceKm: number;
  amount: number;
};

type DriverRow = {
  id: string;
  status: string;
  active: boolean;
  profile?: { full_name?: string; phone?: string } | null;
  pendingAmount: number;
  pendingDeliveries: number;
  paidThisMonth: number;
  deliveries: PendingDelivery[];
};

type PayoutRow = {
  id: string;
  payoutNumber: string;
  driverId: string;
  driverName: string;
  totalAmount: number;
  paymentMethod: string;
  paidAt: string;
  notes?: string | null;
  proofUrl?: string | null;
  items: Array<{
    deliveryId: string;
    orderNumber: number | null;
    neighborhood: string | null;
    city: string | null;
    deliveredAt: string | null;
    distanceKm: number;
    amount: number;
  }>;
};

type PayoutData = {
  controlStartedAt: string | null;
  summary: { pendingAmount: number; pendingDeliveries: number; paidThisMonth: number; paidBatchesThisMonth: number };
  drivers: DriverRow[];
  payouts: PayoutRow[];
};

function recifeDateKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function orderCode(value: number | null) {
  return value == null ? "Pedido" : `#${String(value).padStart(6, "0")}`;
}

export function PayoutsPanel() {
  const [data, setData] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [payDriver, setPayDriver] = useState<DriverRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [paidDate, setPaidDate] = useState(recifeDateKey());
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [openPayout, setOpenPayout] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/payouts", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os repasses");
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      if (silent) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openPayment(driver: DriverRow) {
    setPayDriver(driver);
    setSelected(new Set(driver.deliveries.map((item) => item.id)));
    setPaymentMethod("pix");
    setPaidDate(recifeDateKey());
    setNotes("");
    setFile(null);
  }

  function toggleDelivery(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedRows = useMemo(() => payDriver?.deliveries.filter((row) => selected.has(row.id)) ?? [], [payDriver, selected]);
  const selectedAmount = useMemo(() => selectedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [selectedRows]);

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    if (!payDriver || !selectedRows.length) return;
    if (!window.confirm(`Confirmar repasse de ${brl.format(selectedAmount)} para ${payDriver.profile?.full_name || "o entregador"}?\n\nDepois de confirmado, essas entregas não poderão ser pagas novamente.`)) return;

    setSaving(true);
    try {
      const form = new FormData();
      form.set("driverId", payDriver.id);
      form.set("deliveryIds", JSON.stringify(selectedRows.map((row) => row.id)));
      form.set("paymentMethod", paymentMethod);
      form.set("paidDate", paidDate);
      form.set("notes", notes);
      if (file) form.set("file", file);

      const response = await fetch("/api/admin/payouts", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) {
        const message = String(payload.error || "Falha ao registrar repasse");
        if (message.includes("already_paid")) throw new Error("Uma das entregas selecionadas já foi paga. Atualize a tela e tente novamente.");
        if (message.includes("before_control")) throw new Error("Uma das entregas é anterior ao início do controle financeiro.");
        throw new Error(message);
      }
      setPayDriver(null);
      await load(true);
      alert(`Repasse ${`REP-${String(Number(payload.payout?.batch_number || 0)).padStart(6, "0")}`} registrado com sucesso.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível registrar o repasse");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="p-4 md:p-6 lg:p-8"><div className="rounded-[2rem] border border-[#E8DCC8] bg-white p-8 text-center text-sm text-slate-500">Carregando financeiro dos entregadores...</div></main>;

  return <main className="p-4 md:p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">Financeiro da entrega</p>
        <h1 className="mt-1 text-3xl font-black text-[#1F2A44]">Repasses</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">Entregas concluídas viram saldo a receber. Ao pagar, selecione as entregas e gere um repasse único e rastreável.</p>
      </div>
      <button disabled={refreshing} onClick={() => load(true)} className="min-h-11 rounded-2xl bg-[#C6A75E] px-4 py-3 text-xs font-black text-[#1F2A44] disabled:opacity-50">{refreshing ? "ATUALIZANDO..." : "ATUALIZAR"}</button>
    </div>

    {error && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
    {!data?.controlStartedAt && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">Controle financeiro ainda não foi ativado. Execute <code>supabase/V6_8_DRIVER_PAYOUTS.sql</code> no projeto correto.</div>}

    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Summary title="A receber" value={brl.format(Number(data?.summary?.pendingAmount || 0))} detail={`${data?.summary?.pendingDeliveries || 0} entregas pendentes`} emphasis />
      <Summary title="Pago este mês" value={brl.format(Number(data?.summary?.paidThisMonth || 0))} detail={`${data?.summary?.paidBatchesThisMonth || 0} repasses`} />
      <Summary title="Entregadores com saldo" value={String((data?.drivers || []).filter((row) => row.pendingDeliveries > 0).length)} detail="contas com repasse pendente" />
      <Summary title="Controle iniciado" value={formatDate(data?.controlStartedAt)} detail="entregas anteriores ficam fora" />
    </section>

    <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
      <section className="rounded-[2rem] border border-[#E8DCC8] bg-white p-5">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">Pendências</p><h2 className="mt-1 text-xl font-black text-[#1F2A44]">Por entregador</h2></div><span className="text-xs font-bold text-slate-400">{data?.drivers?.length || 0} cadastrados</span></div>
        <div className="mt-4 space-y-3">
          {(data?.drivers || []).length ? data!.drivers.map((driver) => <div key={driver.id} className="rounded-2xl border border-slate-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="font-black text-[#1F2A44]">{driver.profile?.full_name || "Entregador"}</p><p className="mt-1 text-xs text-slate-400">{driver.profile?.phone || "Sem telefone"} • {driver.active ? "Conta ativa" : "Conta desativada"}</p></div>
              <div className="text-right"><p className="text-[10px] font-black uppercase text-slate-400">A receber</p><p className={`text-lg font-black ${driver.pendingAmount > 0 ? "text-amber-700" : "text-emerald-700"}`}>{brl.format(driver.pendingAmount)}</p></div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#F8F5EF] p-3 text-center">
              <div><p className="text-[9px] font-bold uppercase text-slate-400">Pendentes</p><strong className="text-sm text-[#1F2A44]">{driver.pendingDeliveries}</strong></div>
              <div><p className="text-[9px] font-bold uppercase text-slate-400">Pago/mês</p><strong className="text-sm text-[#1F2A44]">{brl.format(driver.paidThisMonth)}</strong></div>
              <div><p className="text-[9px] font-bold uppercase text-slate-400">Situação</p><strong className="text-sm text-[#1F2A44]">{driver.pendingDeliveries ? "PENDENTE" : "EM DIA"}</strong></div>
            </div>
            {driver.pendingDeliveries > 0 ? <button onClick={() => openPayment(driver)} className="mt-3 min-h-11 w-full rounded-xl bg-[#1F2A44] px-4 text-xs font-black text-white">REALIZAR REPASSE</button> : <p className="mt-3 text-center text-xs font-bold text-emerald-700">✓ Nenhuma entrega aguardando pagamento</p>}
          </div>) : <p className="rounded-2xl bg-[#F8F5EF] p-5 text-sm text-slate-500">Nenhum entregador cadastrado.</p>}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#E8DCC8] bg-white p-5">
        <p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">Histórico</p><h2 className="mt-1 text-xl font-black text-[#1F2A44]">Repasses realizados</h2>
        <div className="mt-4 space-y-3">
          {(data?.payouts || []).length ? data!.payouts.map((payout) => <div key={payout.id} className="overflow-hidden rounded-2xl border border-slate-100">
            <button type="button" onClick={() => setOpenPayout((value) => value === payout.id ? null : payout.id)} className="flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left">
              <div className="min-w-0"><p className="font-black text-[#1F2A44]">{payout.payoutNumber} • {payout.driverName}</p><p className="mt-1 text-xs text-slate-400">{formatDate(payout.paidAt)} • {methodLabel[payout.paymentMethod] || payout.paymentMethod} • {payout.items.length} entregas</p></div>
              <div className="shrink-0 text-right"><p className="font-black text-emerald-700">{brl.format(payout.totalAmount)}</p><p className="text-xs text-slate-400">{openPayout === payout.id ? "Fechar" : "Detalhes"}</p></div>
            </button>
            {openPayout === payout.id && <div className="border-t border-slate-100 bg-[#F8F5EF] p-4">
              <div className="space-y-2">{payout.items.map((item) => <div key={item.deliveryId} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm"><div><strong>{orderCode(item.orderNumber)}</strong><p className="text-xs text-slate-400">{item.deliveredAt ? formatDate(item.deliveredAt, true) : "Entrega"} • {[item.neighborhood, item.city].filter(Boolean).join(" • ")}</p></div><strong>{brl.format(item.amount)}</strong></div>)}</div>
              {payout.notes && <p className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-600"><strong>Observação:</strong> {payout.notes}</p>}
              {payout.proofUrl && <a href={payout.proofUrl} target="_blank" rel="noreferrer" className="mt-3 grid min-h-11 place-items-center rounded-xl border border-[#D8C7AC] bg-white px-4 text-xs font-black text-[#1F2A44]">ABRIR COMPROVANTE</a>}
            </div>}
          </div>) : <p className="rounded-2xl bg-[#F8F5EF] p-5 text-sm text-slate-500">Os repasses confirmados aparecerão aqui com número, entregas e comprovante.</p>}
        </div>
      </section>
    </div>

    {payDriver && <div className="fixed inset-0 z-50 overflow-y-auto bg-[#10182B]/60 p-4 backdrop-blur-sm">
      <form onSubmit={submitPayment} className="mx-auto my-5 w-full max-w-2xl rounded-[2rem] bg-white p-5 shadow-2xl md:p-6">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-[#A88A45]">Novo repasse</p><h2 className="mt-1 text-2xl font-black text-[#1F2A44]">{payDriver.profile?.full_name || "Entregador"}</h2><p className="mt-1 text-sm text-slate-500">Selecione exatamente quais entregas estão sendo quitadas.</p></div><button type="button" onClick={() => setPayDriver(null)} className="grid size-11 place-items-center rounded-xl bg-slate-100 text-xl">×</button></div>

        <div className="mt-5 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-[#E8DCC8] p-3">
          {payDriver.deliveries.map((row) => <label key={row.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-[#F8F5EF]">
            <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleDelivery(row.id)} className="size-5 accent-[#1F2A44]" />
            <div className="min-w-0 flex-1"><p className="font-black text-[#1F2A44]">{orderCode(row.orderNumber)}</p><p className="truncate text-xs text-slate-400">{formatDate(row.deliveredAt, true)} • {[row.neighborhood, row.city].filter(Boolean).join(" • ")} • {row.distanceKm.toFixed(1)} km</p></div>
            <strong className="shrink-0 text-sm text-[#1F2A44]">{brl.format(row.amount)}</strong>
          </label>)}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#1F2A44] p-4 text-white"><div><p className="text-[10px] font-black uppercase text-[#C6A75E]">Total do repasse</p><p className="mt-1 text-xs text-slate-300">{selectedRows.length} entregas selecionadas</p></div><strong className="text-2xl">{brl.format(selectedAmount)}</strong></div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 h-12 w-full rounded-2xl border border-[#E8DCC8] bg-white px-4 text-sm text-[#1F2A44]"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="transfer">Transferência</option></select></label>
          <label className="text-xs font-bold text-slate-600">Data do pagamento<input required type="date" value={paidDate} max={recifeDateKey()} onChange={(event) => setPaidDate(event.target.value)} className="mt-1 h-12 w-full rounded-2xl border border-[#E8DCC8] px-4 text-sm text-[#1F2A44]" /></label>
        </div>
        <label className="mt-3 block text-xs font-bold text-slate-600">Observação opcional<textarea value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-2xl border border-[#E8DCC8] p-4 text-sm text-[#1F2A44]" placeholder="Ex.: repasse semanal" /></label>
        <label className="mt-3 block text-xs font-bold text-slate-600">Comprovante opcional<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-1 block w-full rounded-2xl border border-[#E8DCC8] bg-white p-3 text-sm text-slate-500" /><span className="mt-1 block text-[10px] font-normal text-slate-400">JPG, PNG, WebP ou PDF • até 5 MB</span></label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={() => setPayDriver(null)} className="min-h-12 rounded-2xl border border-[#E8DCC8] px-5 text-xs font-black text-[#1F2A44] disabled:opacity-50">CANCELAR</button><button disabled={saving || selectedRows.length === 0} className="min-h-12 rounded-2xl bg-emerald-600 px-6 text-xs font-black text-white disabled:opacity-40">{saving ? "REGISTRANDO..." : "CONFIRMAR PAGAMENTO"}</button></div>
      </form>
    </div>}
  </main>;
}

function Summary({ title, value, detail, emphasis = false }: { title: string; value: string; detail: string; emphasis?: boolean }) {
  return <div className={`rounded-[1.5rem] border p-4 ${emphasis ? "border-amber-200 bg-amber-50" : "border-[#E8DCC8] bg-white"}`}><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</p><p className={`mt-1 text-xl font-black ${emphasis ? "text-amber-800" : "text-[#1F2A44]"}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
