"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Driver = {
  id: string;
  status: "available" | "delivering" | "offline";
  active: boolean;
  created_at?: string;
  updated_at?: string;
  profile?: { full_name?: string; phone?: string; active?: boolean } | null;
  monthStats?: { deliveries: number; payout: number; distanceKm: number };
  activeDelivery?: { id: string; status: string; order?: { order_number?: number; customer_name?: string } | null } | null;
};

type Order = {
  id: string;
  order_number: number;
  payment_status: string;
  total: number;
  delivery_fee: number;
  delivery_distance_km: number | null;
  driver_payout: number;
  customer_name: string;
  neighborhood: string;
  city: string;
};

type ActiveDelivery = {
  id: string;
  driver_id: string;
  status: string;
  distance_km: number | null;
  customer_fee: number;
  driver_payout: number;
  order?: any;
};


type ProofPending = {
  id: string;
  order_id: string;
  delivery_id: string;
  payment_confirmed: boolean;
  proof_reason?: string | null;
  proof_note?: string | null;
  proof_submitted_at?: string | null;
  proofUrl?: string | null;
  order?: { order_number?: number; customer_name?: string; payment_method?: string; payment_status?: string } | null;
  driver?: { id: string; profile?: { full_name?: string } | null } | null;
};

type Rule = { minKm: number; maxKm: number; customerFee: number; driverPayout: number; active?: boolean };

const defaultRules: Rule[] = [
  { minKm: 0, maxKm: 2, customerFee: 5, driverPayout: 4 },
  { minKm: 2, maxKm: 4, customerFee: 7, driverPayout: 5 },
  { minKm: 4, maxKm: 6, customerFee: 9, driverPayout: 6 },
  { minKm: 6, maxKm: 8, customerFee: 12, driverPayout: 8 },
  { minKm: 8, maxKm: 10, customerFee: 15, driverPayout: 10 },
];

function driverLabel(driver: Driver) {
  if (!driver.active) return "INATIVO";
  if (driver.status === "available") return "DISPONÍVEL";
  if (driver.status === "delivering") return "EM ENTREGA";
  return "OFFLINE";
}

function driverClass(driver: Driver) {
  if (!driver.active) return "bg-rose-50 text-rose-700";
  if (driver.status === "available") return "bg-emerald-100 text-emerald-800";
  if (driver.status === "delivering") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-500";
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "EN";
}

function formatUpdatedAt(value?: string) {
  if (!value) return "sem registro";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Recife",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "sem registro";
  }
}

function TeamMetric({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return <div className="rounded-2xl border border-[#E8DCC8] bg-white p-4">
    <p className="text-[10px] font-black uppercase tracking-wider text-[#A88A45]">{label}</p>
    <p className="mt-1 text-2xl font-black text-[#1F2A44]">{value}</p>
    {detail && <p className="mt-1 text-[11px] text-slate-400">{detail}</p>}
  </div>;
}

export default function DeliveriesPage() {
  const [data, setData] = useState<{ drivers: Driver[]; pendingOrders: Order[]; activeDeliveries: ActiveDelivery[]; proofPending?: ProofPending[]; confirmationEnabled?: boolean; role?: string }>({ drivers: [], pendingOrders: [], activeDeliveries: [], proofPending: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [showDriver, setShowDriver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPortal, setShowPortal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);
  const [portalUrl, setPortalUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [portalMessage, setPortalMessage] = useState("");
  const [driverForm, setDriverForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [editForm, setEditForm] = useState({ name: "", phone: "" });
  const [settings, setSettings] = useState({
    postal_code: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "Jaboatão dos Guararapes",
    state: "PE",
    freeDeliveryEnabled: true,
    freeDeliveryFrom: 50,
    maxDistanceKm: 10,
    rules: defaultRules,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/deliveries", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPortalUrl(`${window.location.origin}/entregador/login`); }, []);

  useEffect(() => {
    let cancelled = false;
    if (!showPortal || !portalUrl) return;
    setQrDataUrl("");
    QRCode.toDataURL(portalUrl, { width: 320, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(""); });
    return () => { cancelled = true; };
  }, [showPortal, portalUrl]);

  const availableDrivers = useMemo(() => data.drivers.filter((driver) => driver.active && driver.status === "available"), [data.drivers]);
  const summary = useMemo(() => ({
    available: data.drivers.filter((driver) => driver.active && driver.status === "available").length,
    delivering: data.drivers.filter((driver) => driver.active && driver.status === "delivering").length,
    offline: data.drivers.filter((driver) => driver.active && driver.status === "offline").length,
    inactive: data.drivers.filter((driver) => !driver.active).length,
    total: data.drivers.length,
  }), [data.drivers]);

  async function assign(orderId: string) {
    const driverId = selected[orderId];
    if (!driverId) return alert("Escolha um entregador disponível.");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/deliveries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", orderId, driverId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível atribuir");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao atribuir");
    } finally {
      setSaving(false);
    }
  }

  async function unassign(deliveryId: string) {
    if (!confirm("Remover o entregador deste pedido?")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/deliveries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unassign", deliveryId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível remover");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function reviewProof(proof: ProofPending, approve: boolean) {
    const reviewNote = approve
      ? window.prompt("Observação da aprovação (opcional):", "") ?? ""
      : window.prompt("Informe o motivo da recusa do comprovante:", "");
    if (!approve && (!reviewNote || reviewNote.trim().length < 3)) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: approve ? "approve_proof" : "reject_proof", deliveryId: proof.delivery_id, reviewNote }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Não foi possível revisar o comprovante");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao revisar comprovante");
    } finally {
      setSaving(false);
    }
  }

  async function createDriver(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/drivers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(driverForm) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error === "driver_email_exists" ? "Já existe um usuário com esse e-mail." : body.error || "Não foi possível cadastrar");
      setDriverForm({ name: "", email: "", phone: "", password: "" });
      setShowDriver(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  function openEditDriver(driver: Driver) {
    setEditingDriver(driver);
    setEditForm({ name: driver.profile?.full_name || "", phone: driver.profile?.phone || "" });
  }

  async function saveDriverEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingDriver) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", driverId: editingDriver.id, name: editForm.name, phone: editForm.phone }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível atualizar o entregador");
      setEditingDriver(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function setDriverActive(driver: Driver, active: boolean) {
    if (!active && !confirm(`Desativar ${driver.profile?.full_name || "este entregador"}? O histórico será preservado.`)) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_active", driverId: driver.id, active }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.error === "active_delivery_exists") throw new Error("Não é possível desativar um entregador com entrega ativa.");
        throw new Error(body.error || "Não foi possível alterar o entregador");
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function copyPortalLink() {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setPortalMessage("Link copiado.");
      window.setTimeout(() => setPortalMessage(""), 2200);
    } catch {
      window.prompt("Copie o link do Portal do Entregador:", portalUrl);
    }
  }

  async function openSettings() {
    setShowSettings(true);
    try {
      const response = await fetch("/api/admin/delivery-settings", { cache: "no-store" });
      const body = await response.json();
      if (response.ok) {
        const s = body.settings || {};
        setSettings({
          postal_code: s.origin_postal_code || "",
          street: s.origin_street || "",
          number: s.origin_number || "",
          neighborhood: s.origin_neighborhood || "",
          city: s.origin_city || "Jaboatão dos Guararapes",
          state: s.origin_state || "PE",
          freeDeliveryEnabled: s.free_delivery_enabled !== false,
          freeDeliveryFrom: Number(s.free_delivery_from ?? 50),
          maxDistanceKm: Number(s.max_distance_km ?? 10),
          rules: body.rules?.length ? body.rules.map((rule: any) => ({ minKm: Number(rule.min_km), maxKm: Number(rule.max_km), customerFee: Number(rule.customer_fee), driverPayout: Number(rule.driver_payout), active: rule.active !== false })) : defaultRules,
        });
      }
    } catch { /* mantém os valores atuais */ }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/delivery-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { postal_code: settings.postal_code, street: settings.street, number: settings.number, neighborhood: settings.neighborhood, city: settings.city, state: settings.state },
          freeDeliveryEnabled: settings.freeDeliveryEnabled,
          freeDeliveryFrom: settings.freeDeliveryFrom,
          maxDistanceKm: settings.maxDistanceKm,
          rules: settings.rules,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error === "origin_not_found" ? "Não consegui localizar o endereço da loja. Confira rua, número, bairro e CEP." : body.error || "Falha ao salvar");
      setShowSettings(false);
      alert("Configuração de entrega salva.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  function updateRule(index: number, key: keyof Rule, value: number) {
    setSettings((current) => ({ ...current, rules: current.rules.map((rule, i) => i === index ? { ...rule, [key]: value } : rule) }));
  }

  return <main className="p-4 md:p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">Última etapa</p>
        <h1 className="mt-1 text-3xl font-black text-[#1F2A44]">Entregas</h1>
        <p className="mt-2 text-sm text-slate-500">Pedidos reais que chegaram a <strong>Pronto</strong> aparecem automaticamente aqui.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {data.role === "admin" && <button type="button" onClick={() => setShowPortal(true)} className="rounded-2xl border border-[#C6A75E] bg-[#FFF8E8] px-4 py-3 text-xs font-black text-[#1F2A44]">🛵 PORTAL DO ENTREGADOR</button>}
        {data.role === "admin" && <a href="/admin/repasses" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-800">R$ REPASSES</a>}
        {data.role === "admin" && <button type="button" onClick={openSettings} className="rounded-2xl border border-[#D8C7AC] bg-white px-4 py-3 text-xs font-black text-[#1F2A44]">CONFIGURAR FRETE</button>}
        {data.role === "admin" && <button type="button" onClick={() => setShowDriver(true)} className="rounded-2xl bg-[#1F2A44] px-4 py-3 text-xs font-black text-white">+ ENTREGADOR</button>}
        <button type="button" onClick={load} className="rounded-2xl bg-[#C6A75E] px-4 py-3 text-xs font-black text-[#1F2A44]">ATUALIZAR</button>
      </div>
    </div>

    {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

    {data.confirmationEnabled === false && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Confirmação de entrega ainda não ativada.</strong> Execute a migration V6.8.1 antes de criar novos pedidos.</div>}

    {!!data.proofPending?.length && <section className="mt-5 rounded-[2rem] border-2 border-amber-200 bg-amber-50 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-700">Ação necessária</p><h2 className="mt-1 text-xl font-black text-[#1F2A44]">Comprovantes de entrega pendentes</h2><p className="mt-1 text-sm text-amber-900/70">A foto é uma exceção ao código e só conclui o pedido depois da sua aprovação.</p></div><span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-900">{data.proofPending.length} pendente{data.proofPending.length === 1 ? "" : "s"}</span></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{data.proofPending.map((proof) => <article key={proof.id} className="overflow-hidden rounded-3xl border border-amber-200 bg-white">
        {proof.proofUrl ? <a href={proof.proofUrl} target="_blank" rel="noreferrer" className="block bg-slate-100"><img src={proof.proofUrl} alt="Comprovante fotográfico da entrega" className="h-52 w-full object-cover"/></a> : <div className="grid h-36 place-items-center bg-slate-100 text-sm text-slate-400">Foto indisponível</div>}
        <div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-[#1F2A44]">Pedido #{String(proof.order?.order_number ?? "").padStart(6, "0")}</p><p className="mt-1 text-xs text-slate-500">{proof.order?.customer_name || "Cliente"} • {proof.driver?.profile?.full_name || "Entregador"}</p></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-black text-amber-800">REVISAR</span></div>
          <div className="mt-3 rounded-2xl bg-[#F8F5EF] p-3 text-xs text-slate-600"><p><strong>Motivo:</strong> {proof.proof_reason === "customer_authorized_dropoff" ? "Cliente autorizou deixar no local" : proof.proof_reason === "received_by_third_party" ? "Recebido por outra pessoa" : "Código não disponível"}</p>{proof.proof_note && <p className="mt-1"><strong>Observação:</strong> {proof.proof_note}</p>}<p className="mt-1"><strong>Pagamento:</strong> {proof.order?.payment_status === "paid" ? "Já estava confirmado" : proof.payment_confirmed ? "Entregador declarou confirmado/recebido" : "Não confirmado"}</p></div>
          <p className="mt-3 text-[10px] leading-4 text-slate-400">Confira se a imagem demonstra o ponto de entrega sem expor dados pessoais desnecessários.</p>
          <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={saving} onClick={() => reviewProof(proof, false)} className="min-h-11 rounded-2xl border border-rose-200 text-xs font-black text-rose-700 disabled:opacity-40">RECUSAR</button><button type="button" disabled={saving} onClick={() => reviewProof(proof, true)} className="min-h-11 rounded-2xl bg-emerald-500 text-xs font-black text-white disabled:opacity-40">APROVAR ENTREGA</button></div>
        </div>
      </article>)}</div>
    </section>}

    <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <TeamMetric label="Disponíveis" value={summary.available}/>
      <TeamMetric label="Em entrega" value={summary.delivering}/>
      <TeamMetric label="Offline" value={summary.offline}/>
      <TeamMetric label="Equipe total" value={summary.total} detail={summary.inactive ? `${summary.inactive} inativo${summary.inactive === 1 ? "" : "s"}` : "Todos ativos"}/>
    </section>

    {data.role === "admin" && <section className="mt-5 flex flex-col gap-4 rounded-[2rem] border border-[#E8DCC8] bg-[#FFFDF9] p-5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#A88A45]">Acesso da equipe</p>
        <h2 className="mt-1 text-xl font-black text-[#1F2A44]">Portal do Entregador</h2>
        <p className="mt-1 text-sm text-slate-500">Envie o link ou QR Code para a equipe acessar pelo próprio celular.</p>
        <p className="mt-2 truncate text-xs font-bold text-[#8A7040]">{portalUrl || "/entregador/login"}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" onClick={copyPortalLink} className="rounded-2xl border border-[#D8C7AC] bg-white px-4 py-3 text-xs font-black text-[#1F2A44]">COPIAR LINK</button>
        <button type="button" onClick={() => setShowPortal(true)} className="rounded-2xl bg-[#C6A75E] px-4 py-3 text-xs font-black text-[#1F2A44]">VER QR CODE</button>
        <a href="/entregador/login" target="_blank" rel="noreferrer" className="rounded-2xl bg-[#1F2A44] px-4 py-3 text-xs font-black text-white">ABRIR PORTAL ↗</a>
      </div>
    </section>}

    <div className="mt-6 grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <section className="rounded-[2rem] border border-[#E8DCC8] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-xl font-black">Entregadores</h2><p className="mt-1 text-xs text-slate-400">Desempenho do mês e situação atual</p></div>
          <span className="text-xs font-bold text-slate-400">{data.drivers.length} cadastrados</span>
        </div>
        <div className="mt-4 space-y-3">
          {loading ? <p className="py-8 text-center text-sm text-slate-400">Carregando...</p> : data.drivers.length ? data.drivers.map((driver) => {
            const name = driver.profile?.full_name || "Entregador";
            const activeOrderNumber = driver.activeDelivery?.order?.order_number;
            return <div key={driver.id} className={`rounded-2xl border p-3 ${driver.active ? "border-slate-100" : "border-rose-100 bg-rose-50/20"}`}>
              <div className="flex items-start gap-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-black text-white ${driver.active ? "bg-[#1F2A44]" : "bg-slate-400"}`}>{initials(name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="truncate font-black">{name}</p>{activeOrderNumber != null && <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">PEDIDO #{String(activeOrderNumber).padStart(6, "0")}</span>}</div>
                  <p className="text-xs text-slate-400">{driver.profile?.phone || "Telefone não informado"}</p>
                  <p className="mt-1 text-[10px] text-slate-400">Última atualização: {formatUpdatedAt(driver.updated_at || driver.created_at)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${driverClass(driver)}`}>{driverLabel(driver)}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#F8F5EF] p-3 text-center">
                <div><p className="text-[9px] font-bold uppercase text-slate-400">Entregas</p><strong className="text-sm text-[#1F2A44]">{driver.monthStats?.deliveries || 0}</strong></div>
                <div><p className="text-[9px] font-bold uppercase text-slate-400">Gerado/mês</p><strong className="text-sm text-[#1F2A44]">{brl.format(Number(driver.monthStats?.payout || 0))}</strong></div>
                <div><p className="text-[9px] font-bold uppercase text-slate-400">Distância</p><strong className="text-sm text-[#1F2A44]">{Number(driver.monthStats?.distanceKm || 0).toFixed(1)} km</strong></div>
              </div>
              {data.role === "admin" && <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => openEditDriver(driver)} className="rounded-xl border border-[#E8DCC8] px-3 py-2 text-[10px] font-black text-[#1F2A44]">EDITAR</button>
                {driver.active
                  ? <button type="button" disabled={saving || Boolean(driver.activeDelivery)} onClick={() => setDriverActive(driver, false)} title={driver.activeDelivery ? "Remova ou conclua a entrega ativa antes de desativar." : undefined} className="rounded-xl border border-rose-200 px-3 py-2 text-[10px] font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-40">DESATIVAR</button>
                  : <button type="button" disabled={saving} onClick={() => setDriverActive(driver, true)} className="rounded-xl border border-emerald-200 px-3 py-2 text-[10px] font-black text-emerald-700 disabled:opacity-40">REATIVAR</button>}
              </div>}
            </div>;
          }) : <p className="rounded-2xl bg-[#F8F5EF] p-5 text-sm text-slate-500">Nenhum entregador cadastrado. Crie a primeira conta em <strong>+ Entregador</strong>.</p>}
        </div>
      </section>

      <div className="space-y-5">
        <section className="rounded-[2rem] bg-[#1F2A44] p-5 text-white">
          <p className="text-xs font-black uppercase tracking-wider text-[#C6A75E]">Prontos para sair</p>
          <h2 className="mt-1 text-xl font-black">{data.pendingOrders.length} {data.pendingOrders.length === 1 ? "pedido aguardando" : "pedidos aguardando"} entregador</h2>
          <div className="mt-4 space-y-3">
            {!data.pendingOrders.length ? <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-[#E8DCC8]">Nenhum pedido pronto aguardando entregador.</div> : data.pendingOrders.map((order) => <div key={order.id} className="rounded-2xl border border-[#34415A] bg-[#26334F] p-4">
              <div className="flex justify-between gap-3"><strong>#{String(order.order_number).padStart(6, "0")}</strong><span className="text-xs text-slate-300">{order.neighborhood} • {order.city}</span></div>
              <p className="mt-2 text-sm text-[#E8DCC8]">{order.customer_name} • {order.delivery_distance_km != null ? `${Number(order.delivery_distance_km).toFixed(1)} km` : "distância pendente"} • Frete {brl.format(Number(order.delivery_fee || 0))}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <select value={selected[order.id] || ""} onChange={(e) => setSelected((current) => ({ ...current, [order.id]: e.target.value }))} className="h-11 flex-1 rounded-xl border border-white/10 bg-white px-3 text-xs font-bold text-[#1F2A44]"><option value="">Escolher entregador</option>{availableDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.profile?.full_name || "Entregador"}</option>)}</select>
                <button disabled={saving || !selected[order.id]} onClick={() => assign(order.id)} className="rounded-xl bg-[#C6A75E] px-4 py-2 text-xs font-black text-[#1F2A44] disabled:opacity-40">ATRIBUIR</button>
              </div>
            </div>)}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#E8DCC8] bg-white p-5">
          <p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">Em andamento</p>
          <h2 className="mt-1 text-xl font-black text-[#1F2A44]">Entregas atribuídas</h2>
          <div className="mt-4 space-y-3">
            {!data.activeDeliveries.length ? <p className="rounded-2xl bg-[#F8F5EF] p-5 text-sm text-slate-500">Nenhuma entrega ativa.</p> : data.activeDeliveries.map((delivery) => {
              const driver = data.drivers.find((item) => item.id === delivery.driver_id);
              return <div key={delivery.id} className="rounded-2xl border border-[#E8DCC8] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong>#{String(delivery.order?.order_number ?? "").padStart(6, "0")} • {driver?.profile?.full_name || "Entregador"}</strong><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${delivery.status === "started" ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700"}`}>{delivery.status === "started" ? "EM ROTA" : "ATRIBUÍDO"}</span></div>
                <p className="mt-2 text-sm text-slate-500">{delivery.order?.customer_name} • {delivery.distance_km != null ? `${Number(delivery.distance_km).toFixed(1)} km` : "sem distância"} • entregador {brl.format(Number(delivery.driver_payout || 0))}</p>
                {delivery.status === "assigned" && <button onClick={() => unassign(delivery.id)} className="mt-3 text-xs font-black text-rose-600">REMOVER ATRIBUIÇÃO</button>}
              </div>;
            })}
          </div>
        </section>
      </div>
    </div>

    {portalMessage && <div className="fixed bottom-5 right-5 z-[70] rounded-2xl bg-[#1F2A44] px-4 py-3 text-xs font-black text-white shadow-xl">{portalMessage}</div>}

    {showPortal && <div className="fixed inset-0 z-50 grid place-items-center bg-[#10182B]/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-[#A88A45]">Equipe de entrega</p><h2 className="mt-1 text-2xl font-black text-[#1F2A44]">Portal do Entregador</h2><p className="mt-2 text-sm text-slate-500">Abra no celular do entregador ou envie o acesso pelo WhatsApp.</p></div><button type="button" onClick={() => setShowPortal(false)} className="text-xl">×</button></div>
        <div className="mt-5 grid place-items-center rounded-[2rem] bg-[#F8F5EF] p-5">
          {qrDataUrl ? <img src={qrDataUrl} width={240} height={240} alt="QR Code para acessar o Portal do Entregador" className="rounded-2xl bg-white p-2"/> : <div className="grid size-60 place-items-center rounded-2xl bg-white text-center text-xs font-bold text-slate-400">Gerando QR Code...</div>}
        </div>
        <p className="mt-4 break-all rounded-2xl border border-[#E8DCC8] bg-white p-3 text-center text-xs font-bold text-[#1F2A44]">{portalUrl || "/entregador/login"}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={copyPortalLink} className="rounded-2xl border border-[#E8DCC8] px-4 py-3 text-xs font-black text-[#1F2A44]">COPIAR LINK</button><a href="/entregador/login" target="_blank" rel="noreferrer" className="rounded-2xl bg-[#C6A75E] px-4 py-3 text-center text-xs font-black text-[#1F2A44]">ABRIR PORTAL ↗</a></div>
        <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900"><strong>Teste no mesmo computador:</strong> abra o portal em uma janela anônima ou em outro navegador para não substituir a sessão administrativa.</p>
      </div>
    </div>}

    {editingDriver && <div className="fixed inset-0 z-50 grid place-items-center bg-[#10182B]/55 p-4 backdrop-blur-sm">
      <form onSubmit={saveDriverEdit} className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-[#A88A45]">Cadastro da equipe</p><h2 className="mt-1 text-2xl font-black text-[#1F2A44]">Editar entregador</h2></div><button type="button" onClick={() => setEditingDriver(null)} className="text-xl">×</button></div>
        <div className="mt-5 grid gap-3"><label className="grid gap-1 text-xs font-black text-[#1F2A44]">Nome completo<input required value={editForm.name} onChange={(e) => setEditForm((current) => ({ ...current, name: e.target.value }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4 text-sm font-medium"/></label><label className="grid gap-1 text-xs font-black text-[#1F2A44]">Telefone<input value={editForm.phone} onChange={(e) => setEditForm((current) => ({ ...current, phone: e.target.value }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4 text-sm font-medium" placeholder="(81) 99999-9999"/></label></div>
        <p className="mt-3 text-xs text-slate-500">O histórico de entregas permanece vinculado à mesma conta.</p>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditingDriver(null)} className="rounded-2xl border border-[#E8DCC8] px-4 py-3 text-xs font-black">CANCELAR</button><button disabled={saving} className="rounded-2xl bg-[#1F2A44] px-5 py-3 text-xs font-black text-white disabled:opacity-50">SALVAR ALTERAÇÕES</button></div>
      </form>
    </div>}

    {showDriver && <div className="fixed inset-0 z-50 grid place-items-center bg-[#10182B]/55 p-4 backdrop-blur-sm">
      <form onSubmit={createDriver} className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-[#A88A45]">Equipe de entrega</p><h2 className="mt-1 text-2xl font-black text-[#1F2A44]">Cadastrar entregador</h2></div><button type="button" onClick={() => setShowDriver(false)} className="text-xl">×</button></div>
        <div className="mt-5 grid gap-3"><input required value={driverForm.name} onChange={(e) => setDriverForm((current) => ({ ...current, name: e.target.value }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4" placeholder="Nome completo"/><input required type="email" value={driverForm.email} onChange={(e) => setDriverForm((current) => ({ ...current, email: e.target.value }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4" placeholder="E-mail de acesso"/><input value={driverForm.phone} onChange={(e) => setDriverForm((current) => ({ ...current, phone: e.target.value }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4" placeholder="Telefone"/><input required minLength={8} type="password" value={driverForm.password} onChange={(e) => setDriverForm((current) => ({ ...current, password: e.target.value }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4" placeholder="Senha inicial (mín. 8 caracteres)"/></div>
        <p className="mt-3 text-xs text-slate-500">Essa conta terá apenas o perfil <strong>driver</strong> e visualizará somente a entrega atribuída a ela.</p>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowDriver(false)} className="rounded-2xl border border-[#E8DCC8] px-4 py-3 text-xs font-black">CANCELAR</button><button disabled={saving} className="rounded-2xl bg-[#1F2A44] px-5 py-3 text-xs font-black text-white disabled:opacity-50">CRIAR CONTA</button></div>
      </form>
    </div>}

    {showSettings && <div className="fixed inset-0 z-50 overflow-y-auto bg-[#10182B]/55 p-4 backdrop-blur-sm">
      <form onSubmit={saveSettings} className="mx-auto my-6 w-full max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-[#A88A45]">Logística</p><h2 className="mt-1 text-2xl font-black text-[#1F2A44]">Configuração do frete</h2><p className="mt-2 text-sm text-slate-500">Defina o ponto de coleta, frete grátis e as faixas por distância.</p></div><button type="button" onClick={() => setShowSettings(false)} className="text-xl">×</button></div>
        <h3 className="mt-6 font-black text-[#1F2A44]">Origem das entregas</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><input required value={settings.postal_code} onChange={(e) => setSettings((current) => ({ ...current, postal_code: e.target.value }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4" placeholder="CEP"/><input required value={settings.neighborhood} onChange={(e) => setSettings((current) => ({ ...current, neighborhood: e.target.value }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4" placeholder="Bairro"/><input required value={settings.street} onChange={(e) => setSettings((current) => ({ ...current, street: e.target.value }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4 sm:col-span-2" placeholder="Rua"/><input required value={settings.number} onChange={(e) => setSettings((current) => ({ ...current, number: e.target.value }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4" placeholder="Número"/><div className="grid grid-cols-[1fr_90px] gap-2"><input required value={settings.city} onChange={(e) => setSettings((current) => ({ ...current, city: e.target.value }))} className="h-12 min-w-0 rounded-2xl border border-[#E8DCC8] px-4" placeholder="Cidade"/><input required maxLength={2} value={settings.state} onChange={(e) => setSettings((current) => ({ ...current, state: e.target.value.toUpperCase() }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4" placeholder="UF"/></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><label className="rounded-2xl border border-[#E8DCC8] p-4"><span className="text-xs font-black">Frete grátis</span><div className="mt-2"><input type="checkbox" checked={settings.freeDeliveryEnabled} onChange={(e) => setSettings((current) => ({ ...current, freeDeliveryEnabled: e.target.checked }))}/> <span className="text-sm">Ativado</span></div></label><label className="grid gap-2 text-xs font-black">Grátis a partir de<input type="number" min="0" step="0.01" value={settings.freeDeliveryFrom} onChange={(e) => setSettings((current) => ({ ...current, freeDeliveryFrom: Number(e.target.value) }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4 text-sm font-medium"/></label><label className="grid gap-2 text-xs font-black">Distância máxima (km)<input type="number" min="1" step="0.1" value={settings.maxDistanceKm} onChange={(e) => setSettings((current) => ({ ...current, maxDistanceKm: Number(e.target.value) }))} className="h-12 rounded-2xl border border-[#E8DCC8] px-4 text-sm font-medium"/></label></div>
        <h3 className="mt-6 font-black text-[#1F2A44]">Faixas por distância</h3>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="text-left text-[10px] uppercase text-slate-400"><th className="pb-2">De km</th><th className="pb-2">Até km</th><th className="pb-2">Cliente paga</th><th className="pb-2">Entregador recebe</th></tr></thead><tbody>{settings.rules.map((rule, index) => <tr key={index}><td className="py-1 pr-2"><input type="number" step="0.1" value={rule.minKm} onChange={(e) => updateRule(index, "minKm", Number(e.target.value))} className="h-11 w-full rounded-xl border border-[#E8DCC8] px-3"/></td><td className="py-1 pr-2"><input type="number" step="0.1" value={rule.maxKm} onChange={(e) => updateRule(index, "maxKm", Number(e.target.value))} className="h-11 w-full rounded-xl border border-[#E8DCC8] px-3"/></td><td className="py-1 pr-2"><input type="number" step="0.01" value={rule.customerFee} onChange={(e) => updateRule(index, "customerFee", Number(e.target.value))} className="h-11 w-full rounded-xl border border-[#E8DCC8] px-3"/></td><td className="py-1"><input type="number" step="0.01" value={rule.driverPayout} onChange={(e) => updateRule(index, "driverPayout", Number(e.target.value))} className="h-11 w-full rounded-xl border border-[#E8DCC8] px-3"/></td></tr>)}</tbody></table></div>
        <p className="mt-3 rounded-2xl bg-[#F8F5EF] p-4 text-xs text-slate-600">Exemplo: se o pedido tiver <strong>R$ {Number(settings.freeDeliveryFrom).toFixed(2).replace(".", ",")}</strong> ou mais, o cliente paga R$ 0 de frete. O valor do entregador continua sendo calculado pela faixa de distância.</p>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowSettings(false)} className="rounded-2xl border border-[#E8DCC8] px-4 py-3 text-xs font-black">CANCELAR</button><button disabled={saving} className="rounded-2xl bg-[#C6A75E] px-5 py-3 text-xs font-black text-[#1F2A44] disabled:opacity-50">SALVAR E LOCALIZAR ORIGEM</button></div>
      </form>
    </div>}
  </main>;
}
