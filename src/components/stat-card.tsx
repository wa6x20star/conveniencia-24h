export function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-3xl border border-[#E8DCC8] bg-[#fffdf9] p-5 shadow-[0_8px_30px_rgba(31,42,68,.045)]">
      <p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#8D8275]">{label}</p>
      <p className="font-display mt-2 text-3xl font-extrabold tracking-tight text-[#1F2A44]">{value}</p>
      {note && <p className="mt-2 text-xs font-medium text-[#777066]">{note}</p>}
    </div>
  );
}
