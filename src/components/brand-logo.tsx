import Link from "next/link";

type BrandMarkProps = {
  className?: string;
  inverted?: boolean;
};

export function BrandMark({ className = "size-11", inverted = false }: BrandMarkProps) {
  const bag = inverted ? "#F6F4F1" : "#1F2A44";
  const bolt = inverted ? "#1F2A44" : "#C6A75E";
  const gold = "#C6A75E";

  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden="true">
      <path d="M3 31h15M7 38h11M11 45h9" stroke={gold} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M25 13c9-9 27-8 37 3 8 9 9 22 3 32" fill="none" stroke={gold} strokeWidth="4" strokeLinecap="round" />
      <path d="M30 22c0-7 4-11 9-11s9 4 9 11" fill="none" stroke={bag} strokeWidth="4" strokeLinecap="round" />
      <path d="M23 22h31c3 0 5 2 5 5l-3 29c0 4-3 6-7 6H27c-4 0-7-2-7-6l-2-29c0-3 2-5 5-5Z" fill={bag} />
      <path d="m41 28-12 18h9l-5 13 15-20h-9l2-11Z" fill={bolt} />
    </svg>
  );
}

type BrandLogoProps = {
  href?: string;
  className?: string;
  inverted?: boolean;
  compact?: boolean;
  tagline?: boolean;
};

export function BrandLogo({ href = "/", className = "", inverted = false, compact = false, tagline = false }: BrandLogoProps) {
  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <BrandMark className={compact ? "size-10" : "size-11 md:size-12"} inverted={inverted} />
      {!compact && (
        <div className="min-w-0">
          <div className={`font-display flex items-baseline gap-1 whitespace-nowrap font-extrabold tracking-[-.045em] ${inverted ? "text-white" : "text-[#1F2A44]"}`}>
            <span className="text-[1.05rem] sm:text-[1.18rem] md:text-[1.28rem]">Conveniência</span>
            <span className="text-[1.05rem] text-[#C6A75E] sm:text-[1.18rem] md:text-[1.28rem]">24h</span>
          </div>
          {tagline && (
            <p className={`mt-0.5 hidden text-[7px] font-bold uppercase tracking-[.24em] md:block ${inverted ? "text-[#E8DCC8]" : "text-[#776E63]"}`}>
              Tudo o que você precisa, a qualquer hora.
            </p>
          )}
        </div>
      )}
    </div>
  );

  return href ? <Link href={href} aria-label="Conveniência 24h - início">{content}</Link> : content;
}
