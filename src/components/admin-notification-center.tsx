"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Priority = "critical" | "high" | "medium" | "info";
type Category = "orders" | "deliveries" | "stock" | "finance";
type NotificationItem = { id:string;category:Category;priority:Priority;title:string;message:string;href:string;actionLabel:string;createdAt:string;orderNumber?:number|null };
type NotificationData = { notifications:NotificationItem[];counts:{total:number;orders:number;deliveries:number;stock:number;finance:number;critical:number;high:number;medium:number;info:number};generatedAt:string };

const SOUND_KEY = "conv24-admin-notification-sound";
const RECEIVED_KEY = "conv24-admin-received-order-alerts";

function priorityClass(priority: Priority) {
  if (priority === "critical") return "bg-rose-100 text-rose-700";
  if (priority === "high") return "bg-amber-100 text-amber-800";
  if (priority === "medium") return "bg-[#F4ECDF] text-[#8A6522]";
  return "bg-slate-100 text-slate-600";
}

function priorityLabel(priority: Priority) {
  return priority === "critical" ? "CRÍTICO" : priority === "high" ? "ATENÇÃO" : priority === "medium" ? "PENDÊNCIA" : "INFO";
}

async function beep() {
  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    if (ctx.state === "suspended") await ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.24);
    oscillator.addEventListener("ended", () => void ctx.close(), { once: true });
  } catch {}
}

export function AdminNotificationCenter() {
  const [data, setData] = useState<NotificationData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const initialized = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json() as NotificationData;
      setData(next);

      const receivedIds = next.notifications.filter((item) => item.id.startsWith("order-received-")).map((item) => item.id);
      const previousRaw = localStorage.getItem(RECEIVED_KEY);
      const previous = previousRaw ? new Set<string>(JSON.parse(previousRaw)) : new Set<string>();
      if (initialized.current && soundEnabled && receivedIds.some((id) => !previous.has(id))) void beep();
      localStorage.setItem(RECEIVED_KEY, JSON.stringify(receivedIds.slice(0, 60)));
      initialized.current = true;
    } catch {
      // O sino continua utilizável mesmo se uma atualização isolada falhar.
    } finally {
      setLoading(false);
    }
  }, [soundEnabled]);

  useEffect(() => {
    setSoundEnabled(localStorage.getItem(SOUND_KEY) === "1");
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [load]);

  const topItems = useMemo(() => data?.notifications.slice(0, 8) ?? [], [data]);
  const total = data?.counts.total ?? 0;
  const critical = data?.counts.critical ?? 0;

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    if (next) void beep();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-10 place-items-center rounded-xl border border-[#E8DCC8] bg-white text-lg text-[#1F2A44] transition hover:bg-[#F8F5EF]"
        aria-label={`Notificações operacionais${total ? `: ${total} pendências` : ""}`}
        aria-expanded={open}
      >
        <span aria-hidden>🔔</span>
        {total > 0 && <span className={`absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full px-1 text-[9px] font-black text-white ${critical ? "bg-rose-600" : "bg-[#C6A75E]"}`}>{total > 99 ? "99+" : total}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,420px)] overflow-hidden rounded-[1.6rem] border border-[#E8DCC8] bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-[#F0E7DA] p-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#A88A45]">Operação</p><h2 className="text-lg font-black text-[#1F2A44]">Notificações</h2><p className="mt-1 text-xs text-slate-500">{total ? `${total} pendência${total === 1 ? "" : "s"} ativa${total === 1 ? "" : "s"}` : "Nenhuma pendência agora"}</p></div>
            <div className="flex gap-1"><button type="button" onClick={toggleSound} title="Som para novos pedidos" className={`grid size-9 place-items-center rounded-xl text-sm ${soundEnabled ? "bg-[#FFF3D6]" : "bg-slate-100"}`}>{soundEnabled ? "🔊" : "🔇"}</button><button type="button" onClick={() => void load()} disabled={loading} title="Atualizar" className="grid size-9 place-items-center rounded-xl bg-slate-100 text-sm disabled:opacity-50">↻</button></div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {topItems.map((item) => (
              <Link key={item.id} href={item.href} onClick={() => setOpen(false)} className="block rounded-2xl p-3 transition hover:bg-[#F8F5EF]">
                <div className="flex items-start justify-between gap-3"><p className="text-sm font-black leading-5 text-[#1F2A44]">{item.title}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black ${priorityClass(item.priority)}`}>{priorityLabel(item.priority)}</span></div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.message}</p>
                <p className="mt-2 text-[10px] font-black text-[#A88A45]">{item.actionLabel} →</p>
              </Link>
            ))}
            {!topItems.length && <div className="px-4 py-10 text-center"><div className="text-4xl">✓</div><p className="mt-3 font-black text-[#1F2A44]">Operação em dia</p><p className="mt-1 text-xs text-slate-500">O sino volta a avisar quando surgir uma pendência.</p></div>}
          </div>
          <div className="border-t border-[#F0E7DA] p-3"><Link href="/admin/notificacoes" onClick={() => setOpen(false)} className="block rounded-xl bg-[#1F2A44] px-4 py-3 text-center text-xs font-black text-white">ABRIR CENTRAL DE NOTIFICAÇÕES</Link></div>
        </div>
      )}
    </div>
  );
}
