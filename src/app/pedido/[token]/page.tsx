import Link from "next/link";

const steps = [
  { label: "Pedido recebido", done: true, time: "21:32" },
  { label: "Separando", done: true, time: "21:34" },
  { label: "Pedido pronto", done: true, time: "21:40" },
  { label: "Saiu para entrega", done: false, time: "" },
  { label: "Entregue", done: false, time: "" },
];
export default function TrackingPage(){return <div className="min-h-screen bg-slate-950 px-4 py-8 text-white"><main className="mx-auto max-w-xl"><Link href="/" className="text-sm font-bold text-slate-400">← Voltar para a loja</Link><div className="mt-5 rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl"><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">PEDIDO #000157</span><h1 className="mt-4 text-3xl font-black">Seu pedido está quase saindo. 🛵</h1><p className="mt-2 text-sm leading-6 text-slate-500">Acompanhe o andamento sem precisar chamar no WhatsApp.</p><div className="mt-7 space-y-0">{steps.map((step,index)=><div key={step.label} className="grid grid-cols-[36px_1fr_auto] gap-3"><div className="flex flex-col items-center"><span className={`grid size-8 place-items-center rounded-full text-xs font-black ${step.done?"bg-emerald-500 text-slate-950":"bg-slate-100 text-slate-400"}`}>{step.done?"✓":index+1}</span>{index<steps.length-1&&<span className={`h-10 w-0.5 ${step.done?"bg-emerald-300":"bg-slate-100"}`} />}</div><p className={`pt-1.5 text-sm font-black ${step.done?"text-slate-950":"text-slate-400"}`}>{step.label}</p><span className="pt-1.5 text-xs font-bold text-slate-400">{step.time}</span></div>)}</div><div className="mt-6 rounded-2xl bg-slate-100 p-4"><div className="flex justify-between text-sm"><span className="text-slate-500">Total</span><strong>R$ 64,80</strong></div><div className="mt-2 flex justify-between text-sm"><span className="text-slate-500">Pagamento</span><strong className="text-emerald-700">PIX • PAGO</strong></div></div></div></main></div>}
