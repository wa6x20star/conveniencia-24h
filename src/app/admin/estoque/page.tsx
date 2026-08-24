"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Product = {
  id: number;
  sku: string;
  name: string;
  image?: string;
  storeProductId: string;
  onHand: number;
  reserved: number;
  stock: number;
  minimumStock: number;
  sold: number;
  soldToday: number;
  active: boolean;
};

type Movement = {
  id: number;
  productName: string;
  sku: string;
  type: string;
  quantity: number;
  reason: string;
  orderId?: string | null;
  createdAt: string;
};

type Action = "entry" | "loss" | "damage" | "adjustment" | "inventory";

const movementLabels: Record<string, string> = {
  entry: "Entrada",
  sale: "Venda",
  cancellation: "Cancelamento",
  adjustment: "Ajuste",
  loss: "Perda",
  damage: "Avaria",
  inventory: "Inventário",
};

const actionLabels: Record<Action, string> = {
  entry: "Registrar entrada",
  loss: "Registrar perda",
  damage: "Registrar avaria",
  adjustment: "Ajustar saldo",
  inventory: "Contagem de inventário",
};

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<Movement[]>([]);
  const [role, setRole] = useState<string>("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [action, setAction] = useState<Action>("entry");
  const [quantity, setQuantity] = useState("1");
  const [targetStock, setTargetStock] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/inventory", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 503) throw new Error("Supabase ainda não está conectado. Conclua o V4_SETUP.md e depois execute o V5_STOCK_CONTROL.sql.");
        throw new Error(body.error || "Não foi possível carregar o estoque.");
      }
      setProducts(body.products ?? []);
      setHistory(body.history ?? []);
      setRole(body.role ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar o estoque.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return products;
    return products.filter((product) => `${product.name} ${product.sku}`.toLocaleLowerCase("pt-BR").includes(term));
  }, [products, query]);

  const filteredHistory = useMemo(() => {
    const term = historyQuery.trim().toLocaleLowerCase("pt-BR");
    if (!term) return history;
    return history.filter((item) => `${item.productName} ${item.sku} ${item.reason} ${movementLabels[item.type] ?? item.type}`.toLocaleLowerCase("pt-BR").includes(term));
  }, [history, historyQuery]);

  const totals = useMemo(() => products.reduce((acc, product) => {
    acc.onHand += Number(product.onHand || 0);
    acc.reserved += Number(product.reserved || 0);
    acc.available += Number(product.stock || 0);
    acc.sold += Number(product.sold || 0);
    acc.soldToday += Number(product.soldToday || 0);
    if (Number(product.stock) <= Number(product.minimumStock || 0)) acc.low += 1;
    return acc;
  }, { onHand: 0, reserved: 0, available: 0, sold: 0, soldToday: 0, low: 0 }), [products]);

  function openMovement(product: Product, nextAction: Action = "entry") {
    setSelected(product);
    setAction(nextAction);
    setQuantity("1");
    setTargetStock(String(product.onHand));
    setReason("");
  }

  async function submitMovement(event: FormEvent) {
    event.preventDefault();
    if (!selected || role !== "admin") return;
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        storeProductId: selected.storeProductId,
        action,
        quantity: ["entry", "loss", "damage"].includes(action) ? Number(quantity) : null,
        targetStock: ["adjustment", "inventory"].includes(action) ? Number(targetStock) : null,
        reason,
      };
      const response = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        const known: Record<string, string> = {
          insufficient_available_stock: "Não há saldo disponível suficiente para essa saída.",
          stock_below_reserved: "O novo saldo não pode ser menor que a quantidade já reservada em pedidos.",
          reason_required: "Informe o motivo dessa movimentação.",
          quantity_must_be_positive: "Informe uma quantidade maior que zero.",
          target_stock_invalid: "Informe um saldo físico válido.",
        };
        throw new Error(known[body.error] || body.error || "Não foi possível alterar o estoque.");
      }
      setSelected(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar o estoque.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#A88A45]">Controle operacional</p>
          <h1 className="mt-1 font-display text-3xl font-black text-[#1F2A44]">Estoque</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-[#777066]">Acompanhe físico, reservado, disponível e vendido. Entradas e ajustes ficam registrados no histórico.</p>
        </div>
        <button onClick={() => void load()} className="h-11 rounded-xl border border-[#E8DCC8] bg-white px-4 text-xs font-black text-[#1F2A44]">ATUALIZAR</button>
      </div>

      {message && <div className="mt-5 rounded-2xl border border-[#E7CF9F] bg-[#FFF6E3] p-4 text-sm font-bold text-[#795A22]">{message}</div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ["Físico", totals.onHand, "Tudo que existe na loja"],
          ["Reservado", totals.reserved, "Pedidos ainda não baixados"],
          ["Disponível", totals.available, "Pode ser vendido agora"],
          ["Vendido hoje", totals.soldToday, "Saídas de venda hoje"],
          ["Vendido total", totals.sold, "Histórico carregado"],
          ["Estoque baixo", totals.low, "Produtos para repor"],
        ].map(([label, value, note]) => (
          <div key={String(label)} className="rounded-[1.5rem] border border-[#E8DCC8] bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#9A9186]">{label}</p>
            <p className="mt-2 font-display text-3xl font-black text-[#1F2A44]">{value}</p>
            <p className="mt-1 text-[11px] font-medium text-[#777066]">{note}</p>
          </div>
        ))}
      </section>

      <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#E8DCC8] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE5D6] p-4">
          <div>
            <h2 className="font-display text-xl font-black text-[#1F2A44]">Saldo por produto</h2>
            <p className="mt-1 text-xs font-medium text-[#81796F]">Venda é baixada automaticamente quando o pedido passa para Pronto.</p>
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto ou SKU..." className="h-11 min-w-64 flex-1 rounded-xl border border-[#E8DCC8] bg-[#FFFDFA] px-4 text-sm font-bold text-[#1F2A44] outline-none focus:border-[#C6A75E] sm:max-w-sm" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#F4ECDF] text-[10px] uppercase tracking-wider text-[#766D61]">
              <tr><th className="p-4">Produto</th><th>Físico</th><th>Reservado</th><th>Disponível</th><th>Vendido</th><th>Mínimo</th><th>Situação</th><th className="pr-4 text-right">Ação</th></tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const low = Number(product.stock) <= Number(product.minimumStock || 0);
                return <tr key={product.id} className="border-t border-[#EFE5D6]">
                  <td className="p-4"><div className="flex items-center gap-3">{product.image ? <img src={product.image} alt="" className="size-11 rounded-xl border border-[#E8DCC8] object-contain p-1" /> : <span className="grid size-11 place-items-center rounded-xl bg-[#F4ECDF]">▣</span>}<div><p className="font-black text-[#1F2A44]">{product.name}</p><p className="text-[11px] font-bold text-[#9A9186]">{product.sku}</p></div></div></td>
                  <td className="font-black text-[#1F2A44]">{product.onHand}</td>
                  <td className="font-bold text-[#8A7040]">{product.reserved}</td>
                  <td className="font-black text-[#1F2A44]">{product.stock}</td>
                  <td><span className="font-black text-[#1F2A44]">{product.sold}</span><span className="ml-1 text-[10px] font-bold text-[#9A9186]">({product.soldToday} hoje)</span></td>
                  <td>{product.minimumStock}</td>
                  <td><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${low ? "bg-[#FFF0CF] text-[#8A6522]" : "bg-[#E9F7ED] text-[#16853A]"}`}>{low ? "REPOR" : "OK"}</span></td>
                  <td className="pr-4 text-right"><button disabled={role !== "admin"} onClick={() => openMovement(product)} className="rounded-xl bg-[#1F2A44] px-3 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-35">MOVIMENTAR</button></td>
                </tr>;
              })}
              {!loading && !filteredProducts.length && <tr><td colSpan={8} className="p-10 text-center text-sm font-semibold text-[#8A8278]">Nenhum produto encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#E8DCC8] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE5D6] p-4">
          <div><h2 className="font-display text-xl font-black text-[#1F2A44]">Histórico de movimentações</h2><p className="mt-1 text-xs font-medium text-[#81796F]">Entrada, venda, perda, avaria, ajuste e inventário.</p></div>
          <input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Filtrar histórico..." className="h-11 min-w-64 flex-1 rounded-xl border border-[#E8DCC8] bg-[#FFFDFA] px-4 text-sm font-bold text-[#1F2A44] outline-none focus:border-[#C6A75E] sm:max-w-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-[#F8F5EF] text-[10px] uppercase tracking-wider text-[#766D61]"><tr><th className="p-4">Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Motivo</th></tr></thead>
            <tbody>{filteredHistory.slice(0, 200).map((item) => <tr key={item.id} className="border-t border-[#EFE5D6]"><td className="p-4 text-xs font-bold text-[#777066]">{formatDate(item.createdAt)}</td><td><p className="font-black text-[#1F2A44]">{item.productName}</p><p className="text-[10px] font-bold text-[#9A9186]">{item.sku}</p></td><td><span className="rounded-full bg-[#F4ECDF] px-2.5 py-1 text-[10px] font-black text-[#1F2A44]">{movementLabels[item.type] ?? item.type}</span></td><td className={`font-black ${item.quantity < 0 ? "text-[#B23B3B]" : "text-[#16853A]"}`}>{item.quantity > 0 ? "+" : ""}{item.quantity}</td><td className="max-w-sm text-xs font-medium text-[#777066]">{item.reason || (item.type === "sale" ? "Venda do pedido" : "—")}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {selected && <div className="fixed inset-0 z-50 grid place-items-end bg-[#151D31]/65 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
        <form onSubmit={submitMovement} className="w-full max-w-xl rounded-t-[2rem] bg-[#FFFDFA] p-5 shadow-2xl sm:rounded-[2rem] sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#A88A45]">Movimentação de estoque</p><h2 className="mt-1 font-display text-2xl font-black text-[#1F2A44]">{selected.name}</h2><p className="mt-1 text-xs font-bold text-[#81796F]">Físico: {selected.onHand} · Reservado: {selected.reserved} · Disponível: {selected.stock}</p></div><button type="button" onClick={() => setSelected(null)} className="grid size-10 place-items-center rounded-full bg-[#F4ECDF] font-black text-[#1F2A44]">×</button></div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-1.5"><span className="text-xs font-black text-[#1F2A44]">Tipo de movimentação</span><select value={action} onChange={(event) => setAction(event.target.value as Action)} className="h-12 rounded-xl border border-[#E8DCC8] bg-white px-3 font-bold text-[#1F2A44] outline-none focus:border-[#C6A75E]"><option value="entry">Entrada / reposição</option><option value="loss">Perda</option><option value="damage">Avaria</option><option value="adjustment">Ajuste de saldo</option><option value="inventory">Contagem de inventário</option></select></label>

            {["entry", "loss", "damage"].includes(action) ? <label className="grid gap-1.5"><span className="text-xs font-black text-[#1F2A44]">Quantidade</span><input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="h-12 rounded-xl border border-[#E8DCC8] bg-white px-3 font-bold text-[#1F2A44] outline-none focus:border-[#C6A75E]" /></label> : <label className="grid gap-1.5"><span className="text-xs font-black text-[#1F2A44]">Novo saldo físico</span><input type="number" min={selected.reserved} step="1" value={targetStock} onChange={(event) => setTargetStock(event.target.value)} className="h-12 rounded-xl border border-[#E8DCC8] bg-white px-3 font-bold text-[#1F2A44] outline-none focus:border-[#C6A75E]" /><span className="text-[10px] font-bold text-[#9A9186]">Não pode ficar abaixo das {selected.reserved} unidades já reservadas.</span></label>}

            <label className="grid gap-1.5"><span className="text-xs font-black text-[#1F2A44]">Motivo {action === "entry" ? "(opcional)" : ""}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="rounded-xl border border-[#E8DCC8] bg-white p-3 text-sm font-medium text-[#1F2A44] outline-none focus:border-[#C6A75E]" placeholder={action === "entry" ? "Ex.: reposição do fornecedor" : "Informe o motivo da alteração"} /></label>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#E8DCC8] pt-4"><button type="button" onClick={() => setSelected(null)} className="h-11 rounded-xl border border-[#E8DCC8] px-4 text-xs font-black text-[#1F2A44]">CANCELAR</button><button disabled={saving} className="h-11 rounded-xl bg-[#C6A75E] px-5 text-xs font-black text-[#1F2A44] disabled:opacity-50">{saving ? "SALVANDO..." : actionLabels[action].toUpperCase()}</button></div>
        </form>
      </div>}
    </main>
  );
}
