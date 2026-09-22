import Link from "next/link";
import { STORE_CONFIG } from "@/lib/store-config";

type BrandMarkProps = {
  className?: string;
  inverted?: boolean;
};

export function BrandMark({ className = "size-11", inverted = false }: BrandMarkProps) {
  const primary = inverted ? "#F6F4F1" : "var(--store-primary, #1F2A44)";
  const accent = "var(--store-accent, #C6A75E)";

  if (STORE_CONFIG.isBakery) {
    return (
      <svg viewBox="0 0 72 72" className={className} aria-hidden="true">
        <path d="M14 52c-5-4-6-12-2-18 3-5 8-7 13-6 2-7 8-11 15-11 9 0 16 7 16 16 5-1 10 2 12 7 3 7-1 15-8 17-3 1-7 1-10 1H27c-5 0-10-2-13-6Z" fill={primary} />
        <path d="M23 39c4 3 9 3 13 0M37 32c3 2 7 2 10 0M47 43c3 2 7 2 10 0" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <path d="M18 21c1-4 4-7 7-9M31 17c1-4 4-7 7-9M44 18c1-4 4-7 7-9" fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden="true">
      <path d="M3 31h15M7 38h11M11 45h9" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M25 13c9-9 27-8 37 3 8 9 9 22 3 32" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      <path d="M30 22c0-7 4-11 9-11s9 4 9 11" fill="none" stroke={primary} strokeWidth="4" strokeLinecap="round" />
      <path d="M23 22h31c3 0 5 2 5 5l-3 29c0 4-3 6-7 6H27c-4 0-7-2-7-6l-2-29c0-3 2-5 5-5Z" fill={primary} />
      <path d="m41 28-12 18h9l-5 13 15-20h-9l2-11Z" fill={accent} />
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
          <div className={`font-display flex items-baseline gap-1 whitespace-nowrap font-extrabold tracking-[-.045em] ${inverted ? "text-white" : "text-[var(--store-primary)]"}`}>
            <span className="text-[1.05rem] sm:text-[1.18rem] md:text-[1.28rem]">{STORE_CONFIG.name}</span>
          </div>
          {tagline && (
            <p className={`mt-0.5 hidden text-[7px] font-bold uppercase tracking-[.24em] md:block ${inverted ? "text-[#E8DCC8]" : "text-[#776E63]"}`}>
              {STORE_CONFIG.tagline}
            </p>
          )}
        </div>
      )}
    </div>
  );

  return href ? <Link href={href} aria-label={`${STORE_CONFIG.name} - início`}>{content}</Link> : content;
}
