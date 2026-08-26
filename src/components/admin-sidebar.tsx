import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const links = [
  ["/admin", "▦", "Visão geral"],
  ["/admin/pedidos", "▣", "Pedidos"],
  ["/admin/produtos", "□", "Produtos"],
  ["/admin/estoque", "▤", "Estoque"],
  ["/admin/entregas", "➜", "Entregas"],
  ["/admin/repasses", "R$", "Repasses"],
];

export function AdminSidebar({ role }: { role?: string | null }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#1F2A44] p-4 text-white lg:flex lg:flex-col">
      <div className="mb-7 border-b border-white/10 px-1 pb-5 pt-1">
        <BrandLogo inverted tagline />
        <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[.18em] text-[#C6A75E]">Painel de operação</p>
      </div>

      <nav className="space-y-1">
        {links.filter(([href]) => href !== "/admin/repasses" || role === "admin").map(([href, icon, label]) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-[#E8DCC8] transition hover:bg-white/10 hover:text-white">
            <span className="grid size-7 place-items-center rounded-lg bg-white/10 text-[#C6A75E]">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-[#E8DCC8]">
        <p className="font-display font-bold text-white">Loja Piedade</p>
        <p className="mt-1 flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-[#16A34A]" /> Operação online</p>
      </div>
    </aside>
  );
}
