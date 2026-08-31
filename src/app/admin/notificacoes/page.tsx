"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Priority = "critical" | "high" | "medium" | "info";
type Category = "orders" | "deliveries" | "stock" | "finance";
type NotificationItem = { id:string;category:Category;priority:Priority;title:string;message:string;href:string;actionLabel:string;createdAt:string };
type Data = { notifications:NotificationItem[];counts:{total:number;orders:number;deliveries:number;stock:number;finance:number;critical:number;high:number;medium:number;info:number};generatedAt:string };

const categoryLabel:Record<Category,string>={orders:"Pedidos",deliveries:"Entregas",stock:"Estoque",finance:"Financeiro"};
const priorityLabel:Record<Priority,string>={critical:"Crítico",high:"Atenção",medium:"Pendência",info:"Informativo"};

function priorityStyle(priority:Priority){return priority==="critical"?"border-rose-200 bg-rose-50 text-rose-700":priority==="high"?"border-amber-200 bg-amber-50 text-amber-800":priority==="medium"?"border-[#E8DCC8] bg-[#FFF9EF] text-[#8A6522]":"border-slate-200 bg-slate-50 text-slate-600"}

export default function NotificationsPage(){
  const [data,setData]=useState<Data|null>(null);const [filter,setFilter]=useState<"all"|Category>("all");const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await fetch('/api/admin/notifications',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Falha ao carregar');setData(d);}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar notificações');}finally{setLoading(false)}},[]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),20_000);return()=>window.clearInterval(timer)},[load]);
  const items=useMemo(()=>data?.notifications.filter(item=>filter==='all'||item.category===filter)??[],[data,filter]);
  const filters:["all"|Category,string][]=[["all","Todas"],["orders","Pedidos"],["deliveries","Entregas"],["stock","Estoque"],["finance","Financeiro"]];
  return <main className="p-4 md:p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-[#A88A45]">V6.8.3</p><h1 className="mt-1 text-3xl font-black text-[#1F2A44]">Central de notificações</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Aqui aparecem apenas pendências que ainda exigem atenção. Quando o fluxo é resolvido, o alerta desaparece automaticamente.</p></div><button onClick={()=>void load()} disabled={loading} className="rounded-2xl bg-[#1F2A44] px-4 py-3 text-xs font-black text-white disabled:opacity-50">{loading?'ATUALIZANDO...':'↻ ATUALIZAR'}</button></div>
    {error&&<div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-[#E8DCC8] bg-white p-4"><p className="text-xs font-bold text-slate-500">Pendências</p><p className="mt-1 text-3xl font-black text-[#1F2A44]">{data?.counts.total??0}</p></div><div className="rounded-2xl border border-rose-100 bg-white p-4"><p className="text-xs font-bold text-slate-500">Críticas</p><p className="mt-1 text-3xl font-black text-rose-600">{data?.counts.critical??0}</p></div><div className="rounded-2xl border border-amber-100 bg-white p-4"><p className="text-xs font-bold text-slate-500">Atenção</p><p className="mt-1 text-3xl font-black text-amber-700">{data?.counts.high??0}</p></div><div className="rounded-2xl border border-[#E8DCC8] bg-white p-4"><p className="text-xs font-bold text-slate-500">Última leitura</p><p className="mt-2 text-sm font-black text-[#1F2A44]">{data?.generatedAt?new Date(data.generatedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—'}</p></div></section>
    <div className="mt-6 flex gap-2 overflow-x-auto pb-1">{filters.map(([key,label])=><button key={key} onClick={()=>setFilter(key)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black ${filter===key?'bg-[#1F2A44] text-white':'border border-[#E8DCC8] bg-white text-[#1F2A44]'}`}>{label}{key!=='all'&&data?` (${data.counts[key]})`:''}</button>)}</div>
    <section className="mt-4 space-y-3">{items.map(item=><article key={item.id} className="rounded-[1.5rem] border border-[#E8DCC8] bg-white p-4 md:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#F4ECDF] px-2.5 py-1 text-[9px] font-black uppercase text-[#8A6522]">{categoryLabel[item.category]}</span><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${priorityStyle(item.priority)}`}>{priorityLabel[item.priority]}</span></div><h2 className="mt-3 text-lg font-black text-[#1F2A44]">{item.title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{item.message}</p></div><Link href={item.href} className="rounded-xl bg-[#C6A75E] px-4 py-3 text-xs font-black text-[#1F2A44]">{item.actionLabel.toUpperCase()}</Link></div></article>)}{!loading&&!items.length&&<div className="rounded-[2rem] border border-[#E8DCC8] bg-white px-6 py-14 text-center"><div className="text-5xl">✓</div><h2 className="mt-4 text-xl font-black text-[#1F2A44]">Nenhuma pendência neste filtro</h2><p className="mt-2 text-sm text-slate-500">A central é atualizada automaticamente a cada 20 segundos.</p></div>}</section>
  </main>
}
