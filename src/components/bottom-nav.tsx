import Link from "next/link";

const items = [
  ["/", "⌂", "Início"],
  ["/#buscar", "⌕", "Buscar"],
  ["/carrinho", "🛒", "Carrinho"],
  ["/pedido/demo", "▣", "Pedidos"],
  ["/login", "◉", "Conta"],
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map(([href, icon, label]) => (
          <Link key={label} href={href} className="flex flex-col items-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-950">
            <span className="text-lg leading-none">{icon}</span>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
