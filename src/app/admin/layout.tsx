import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminLogout } from "@/components/admin-logout";
import { BrandLogo } from "@/components/brand-logo";
import { getCurrentStaff } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff(["admin", "operation"]);
  if (staff.configured && !staff.user) redirect("/login");
  if (staff.configured && staff.user && !staff.role) redirect("/login");

  return (
    <div className="min-h-screen bg-[#F8F5EF] lg:flex">
      <AdminSidebar role={staff.role} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E8DCC8] bg-[#fffdf9]/95 px-4 backdrop-blur-xl md:px-6">
          <div className="lg:hidden"><BrandLogo compact /></div>
          <div className="hidden lg:block"><p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#9A9186]">Unidade ativa</p><p className="font-display text-sm font-bold text-[#1F2A44]">Loja Piedade</p></div>
          <div className="flex items-center gap-3">
            <span className={`hidden rounded-full px-3 py-1 text-[9px] font-extrabold uppercase tracking-wide sm:inline ${staff.configured ? "bg-[#E9F7ED] text-[#16853A]" : "bg-[#FFF3D6] text-[#8A6522]"}`}>● {staff.configured ? "Banco conectado" : "Configurar banco"}</span>
            {staff.configured && <AdminLogout />}
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-[#E8DCC8] bg-[#fffdf9] px-4 py-3 lg:hidden">
          <Link className="whitespace-nowrap rounded-xl bg-[#1F2A44] px-3 py-2 text-[10px] font-extrabold text-white" href="/admin">Visão geral</Link>
          <Link className="whitespace-nowrap rounded-xl bg-[#F4ECDF] px-3 py-2 text-[10px] font-extrabold text-[#1F2A44]" href="/admin/pedidos">Pedidos</Link>
          <Link className="whitespace-nowrap rounded-xl bg-[#F4ECDF] px-3 py-2 text-[10px] font-extrabold text-[#1F2A44]" href="/admin/produtos">Produtos</Link>
          <Link className="whitespace-nowrap rounded-xl bg-[#F4ECDF] px-3 py-2 text-[10px] font-extrabold text-[#1F2A44]" href="/admin/estoque">Estoque</Link>
          <Link className="whitespace-nowrap rounded-xl bg-[#F4ECDF] px-3 py-2 text-[10px] font-extrabold text-[#1F2A44]" href="/admin/entregas">Entregas</Link>
          {staff.role === "admin" && <Link className="whitespace-nowrap rounded-xl bg-[#F4ECDF] px-3 py-2 text-[10px] font-extrabold text-[#1F2A44]" href="/admin/repasses">Repasses</Link>}
        </nav>
        {!staff.configured && <div className="m-4 rounded-2xl border border-[#E7CF9F] bg-[#FFF6E3] p-4 text-sm font-bold text-[#795A22] md:m-6">A V4 está instalada, mas o Supabase ainda não foi conectado na Vercel. O site público continua usando o catálogo demonstrativo até você concluir o V4_SETUP.md.</div>}
        {children}
      </div>
    </div>
  );
}
