import Link from "next/link";
import { AdminSidebar } from "@/components/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <div className="lg:hidden"><Link href="/admin" className="font-black">⚡ Operação 24h</Link></div>
          <div className="hidden lg:block"><p className="text-xs font-semibold text-slate-400">Unidade ativa</p><p className="text-sm font-black">Loja Piedade</p></div>
          <div className="flex items-center gap-3"><span className="hidden rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 sm:inline">● ONLINE</span><span className="grid size-9 place-items-center rounded-full bg-slate-950 text-xs font-black text-white">AD</span></div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <Link className="whitespace-nowrap rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white" href="/admin">Visão geral</Link><Link className="whitespace-nowrap rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold" href="/admin/pedidos">Pedidos</Link><Link className="whitespace-nowrap rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold" href="/admin/produtos">Produtos</Link><Link className="whitespace-nowrap rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold" href="/admin/estoque">Estoque</Link><Link className="whitespace-nowrap rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold" href="/admin/entregas">Entregas</Link>
        </nav>
        {children}
      </div>
    </div>
  );
}
