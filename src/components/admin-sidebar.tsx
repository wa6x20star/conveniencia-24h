import Link from "next/link";

const links = [
  ["/admin", "▦", "Visão geral"],
  ["/admin/pedidos", "▣", "Pedidos"],
  ["/admin/produtos", "□", "Produtos"],
  ["/admin/estoque", "▤", "Estoque"],
  ["/admin/entregas", "➜", "Entregas"],
];

export function AdminSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[#26334F] bg-[#1F2A44] p-4 text-white lg:flex lg:flex-col">
      <Link href="/admin" className="mb-8 flex items-center gap-3 px-2 py-2 font-black">
        <span className="grid size-10 place-items-center rounded-2xl bg-[#C6A75E] text-[#1F2A44]">⚡</span>
        <span>Operação 24h</span>
      </Link>

      <nav className="space-y-1">
        {links.map(([href, icon, label]) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-[#E8DCC8] transition hover:bg-white/10 hover:text-white"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-white/8 text-[#C6A75E]">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-[#E8DCC8]">
        <p className="font-bold text-white">Loja Piedade</p>
        <p className="mt-1"><span className="mr-1 inline-block size-2 rounded-full bg-[#C6A75E]" /> Operação online</p>
      </div>
    </aside>
  );
}
