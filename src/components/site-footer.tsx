import Link from "next/link";
import { ClockIcon, DeliveryIcon, HeadsetIcon, ShieldIcon, TagIcon } from "@/components/brand-icons";
import { BrandLogo } from "@/components/brand-logo";

const benefits = [
  { icon: ClockIcon, title: "Aberto sempre", text: "Compre a qualquer hora do dia ou da noite." },
  { icon: DeliveryIcon, title: "Entrega rápida", text: "Seu pedido chega rápido, direto na sua porta." },
  { icon: ShieldIcon, title: "Compra segura", text: "Fluxo simples, confiável e transparente." },
  { icon: TagIcon, title: "Ofertas todos os dias", text: "Promoções e novidades selecionadas para você." },
  { icon: HeadsetIcon, title: "Atendimento humano", text: "Fale diretamente com a loja quando precisar." },
];

function LockIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-12 max-w-6xl px-4 pb-8 md:px-6">
      <div className="overflow-hidden rounded-[2rem] bg-[#1F2A44] text-white shadow-[0_22px_55px_rgba(31,42,68,.18)]">
        <div className="grid md:grid-cols-5">
          {benefits.map(({ icon: BenefitIcon, title, text }, index) => (
            <div key={title} className={`flex gap-3 p-5 md:min-h-36 md:flex-col md:justify-center ${index > 0 ? "border-t border-white/10 md:border-l md:border-t-0" : ""}`}>
              <BenefitIcon className="size-8 shrink-0 text-[#C6A75E]" />
              <div>
                <p className="font-display text-sm font-bold text-[#C6A75E]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[#E8DCC8]">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-7">
          <BrandLogo inverted tagline />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-medium text-[#CFC6B7]">
            <span>Conveniência online • atendimento 24 horas</span>
            <span className="hidden h-3 w-px bg-white/15 sm:block" aria-hidden="true" />
            <Link
              href="/admin/estoque"
              title="Acesso à área interna"
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[9px] font-semibold tracking-[.04em] text-[#CFC6B7]/45 transition hover:bg-white/5 hover:text-[#E8DCC8]/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A75E]"
            >
              <LockIcon className="size-3" />
              Área interna
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
