import Link from "next/link";
import { CartIcon, HomeIcon, PackageIcon, SearchIcon, UserIcon } from "@/components/brand-icons";

const items = [
  { href: "/", label: "Início", Icon: HomeIcon },
  { href: "/#buscar", label: "Buscar", Icon: SearchIcon },
  { href: "/carrinho", label: "Carrinho", Icon: CartIcon },
  { href: "/pedido/demo", label: "Pedidos", Icon: PackageIcon },
  { href: "/login", label: "Conta", Icon: UserIcon },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E8DCC8] bg-[#fffdf9]/97 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(31,42,68,.06)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ href, label, Icon }) => (
          <Link key={label} href={href} className="flex flex-col items-center gap-1 rounded-xl px-1 py-1 text-[9px] font-bold text-[#6F685F] transition hover:bg-[#F7F2E9] hover:text-[#1F2A44]">
            <Icon className="size-[19px]" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
