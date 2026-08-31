"use client";

import { useRef, useState } from "react";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export type CancellationOrder = {
  id: string; order_number: number; status: string; payment_status: string; total: number;
  cancellation_reason?: string | null; cancelled_at?: string | null; cancelled_by?: string | null;
  cancellation_source?: string | null; stock_recovered_at?: string | null;
  refund_status?: string; refund_amount?: number; refunded_at?: string | null;
  refunded_by?: string | null; refund_reference?: string | null;
};

export function OrderCancellation({ order, canRefund = false, onChanged }: {
  order: CancellationOrder; canRefund?: boolean; onChanged: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const cancelled = order.status === "cancelled";
  const pending = order.refund_status === "pending";
  const returnedRequired = order.status === "out_for_delivery";
  if (order.status === "delivered") return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/${cancelled ? "refund" : "status"}`, {
        method: cancelled ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cancelled ? { reference: reason.trim(), confirmed } : { status: "cancelled", note: reason.trim(), stockReturned: confirmed }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir.");
      setExpanded(false); setReason(""); setConfirmed(false);
      await onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível concluir."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <div className="mt-3 text-xs">
    {cancelled && <div className="space-y-2 rounded-xl bg-red-50 p-3 text-red-900">
      <p className="font-bold">{order.cancellation_reason || "Cancelamento anterior à V6.8.4"}</p>
      <p>{order.cancelled_at ? new Date(order.cancelled_at).toLocaleString("pt-BR") : "Data não registrada na versão anterior"}</p>
      <p className="break-all">Responsável: {order.cancellation_source === "reservation_expired" ? "Sistema — reserva expirada" : order.cancelled_by || "Não registrado na versão anterior"}</p>
      <p>{order.stock_recovered_at ? "Estoque/reserva recuperado na transação de cancelamento." : "Cancelamento antigo: confira o histórico de estoque."}</p>
      {pending && <p className="font-black">ESTORNO PENDENTE · {brl.format(Number(order.refund_amount || 0))}</p>}
      {order.refund_status === "not_required" && <p>Nenhum pagamento recebido consta no sistema. Se o cliente pagou, confira o financeiro.</p>}
      {order.refund_status === "completed" && <><p className="font-bold">ESTORNO REGISTRADO · {brl.format(Number(order.refund_amount || 0))}</p><p>{order.refunded_at ? new Date(order.refunded_at).toLocaleString("pt-BR") : ""}</p><p className="break-all">Responsável: {order.refunded_by}</p><p>Referência: {order.refund_reference}</p></>}
    </div>}
    {(!cancelled || (pending && canRefund)) && !expanded && <button type="button" onClick={() => { setExpanded(true); setError(""); }} className="mt-2 w-full rounded-xl border border-red-200 px-3 py-2 font-black text-red-700">
      {cancelled ? "REGISTRAR ESTORNO REALIZADO" : "CANCELAR PEDIDO"}
    </button>}
    {expanded && <form onSubmit={submit} className="mt-2 space-y-3 rounded-xl border border-red-200 bg-white p-3">
      <p className="font-bold">{cancelled ? "Esta ação apenas registra uma devolução já feita fora do sistema. Não transfere dinheiro." : "O cancelamento é definitivo. O motivo informado será exibido ao cliente."}</p>
      {!cancelled && <p>{order.payment_status === "paid" ? "Pagamento recebido: será registrado estorno pendente, sem devolução automática." : "O sistema verificará os registros de pagamento antes de definir se há estorno pendente."}</p>}
      <label className="block font-bold">{cancelled ? "Referência da devolução (sem dados bancários sensíveis)" : "Motivo do cancelamento"}
        <textarea autoFocus required minLength={3} maxLength={300} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} className="mt-1 block min-h-20 w-full rounded-lg border border-slate-300 p-2 font-normal" />
      </label>
      {(returnedRequired || cancelled) && <label className="flex items-start gap-2"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} />
        <span>{cancelled ? "Confirmo que o dinheiro já foi devolvido ao cliente." : "Confirmo que TODOS os produtos retornaram à loja e estão aptos para voltar ao estoque. Se houver avaria/perda, não confirme: confira os itens antes."}</span>
      </label>}
      {error && <p role="alert" className="font-bold text-red-700">{error}</p>}
      <div className="flex gap-2"><button disabled={busy || reason.trim().length < 3 || ((returnedRequired || cancelled) && !confirmed)} className="rounded-lg bg-red-700 px-3 py-2 font-bold text-white disabled:opacity-50">{busy ? "SALVANDO..." : cancelled ? "CONFIRMAR REGISTRO" : "CONFIRMAR CANCELAMENTO"}</button>
      <button type="button" disabled={busy} onClick={() => setExpanded(false)} className="rounded-lg border px-3 py-2">Voltar</button></div>
    </form>}
  </div>;
}
