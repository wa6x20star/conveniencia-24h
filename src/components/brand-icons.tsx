import type { ReactNode } from "react";

type IconProps = { className?: string };

function Icon({ children, className = "size-6" }: { children: ReactNode; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>;
}

export function ClockIcon({ className }: IconProps) { return <Icon className={className}><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></Icon>; }
export function DeliveryIcon({ className }: IconProps) { return <Icon className={className}><path d="M3 15h10V7H6l-3 4v4Z"/><path d="M13 10h4l3 3v2h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></Icon>; }
export function ShieldIcon({ className }: IconProps) { return <Icon className={className}><path d="M12 3 5 6v5c0 4.5 2.8 7.7 7 10 4.2-2.3 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></Icon>; }
export function TagIcon({ className }: IconProps) { return <Icon className={className}><path d="M4 4h7l9 9-7 7-9-9V4Z"/><circle cx="8" cy="8" r="1"/></Icon>; }
export function HeadsetIcon({ className }: IconProps) { return <Icon className={className}><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><path d="M4 13h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2ZM20 13h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2Z"/><path d="M17 19c-1 2-3 2-5 2"/></Icon>; }
export function SearchIcon({ className }: IconProps) { return <Icon className={className}><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></Icon>; }
export function CartIcon({ className }: IconProps) { return <Icon className={className}><path d="M3 4h2l2 11h10l2-7H7"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></Icon>; }
export function UserIcon({ className }: IconProps) { return <Icon className={className}><circle cx="12" cy="8" r="3"/><path d="M5 21c1-5 4-7 7-7s6 2 7 7"/></Icon>; }
export function HomeIcon({ className }: IconProps) { return <Icon className={className}><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></Icon>; }
export function PackageIcon({ className }: IconProps) { return <Icon className={className}><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/></Icon>; }
export function ArrowIcon({ className }: IconProps) { return <Icon className={className}><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></Icon>; }
