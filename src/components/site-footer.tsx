import { ClockIcon, DeliveryIcon, HeadsetIcon, ShieldIcon, TagIcon } from "@/components/brand-icons";
import { BrandLogo } from "@/components/brand-logo";

const benefits = [
  { icon: ClockIcon, title: "Aberto sempre", text: "Compre a qualquer hora do dia ou da noite." },
  { icon: DeliveryIcon, title: "Entrega rápida", text: "Seu pedido chega rápido, direto na sua porta." },
  { icon: ShieldIcon, title: "Compra segura", text: "Fluxo simples, confiável e transparente." },
  { icon: TagIcon, title: "Ofertas todos os dias", text: "Promoções e novidades selecionadas para você." },
  { icon: HeadsetIcon, title: "Atendimento humano", text: "Fale diretamente com a loja quando precisar." },
];

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
          <p className="text-[11px] font-medium text-[#CFC6B7]">Conveniência online • atendimento 24 horas</p>
        </div>
      </div>
    </footer>
  );
}
