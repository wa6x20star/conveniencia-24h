export function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-3xl border border-[#E8DCC8] bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.04)]">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-[#1F2A44]">{value}</p>
      {note && <p className="mt-2 text-xs font-medium text-slate-500">{note}</p>}
    </div>
  );
}
