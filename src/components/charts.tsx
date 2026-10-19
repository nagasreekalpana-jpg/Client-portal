import { fmtH, pct, type Summary } from "@/lib/domain";

export function WeekBars({ weeks, weeklyTarget }: { weeks: Summary["weeks"]; weeklyTarget: number }) {
  const max = Math.max(weeklyTarget, ...weeks.map((w) => w.hours)) * 1.1 || 1;
  return (
    <div>
      <div className="relative h-56">
        <div
          className="absolute inset-x-0 border-t border-dashed border-muted/60"
          style={{ bottom: `${pct(weeklyTarget, max)}%` }}
        >
          <span className="absolute -top-5 right-0 text-[11px] text-muted">{fmtH(weeklyTarget)} h target</span>
        </div>
        <div className="absolute inset-0 flex items-end gap-3 border-b border-line sm:gap-6">
          {weeks.map((w) => (
            <div key={w.index} className="flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-xs font-semibold">{fmtH(w.hours)}</span>
              <div
                className={`w-full max-w-16 rounded-t-md ${w.hours > w.target ? "bg-over" : "bg-primary"}`}
                style={{ height: `${pct(w.hours, max)}%` }}
                title={`${w.label}: ${fmtH(w.hours)} h (target ${fmtH(w.target)} h)`}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-3 sm:gap-6">
        {weeks.map((w) => (
          <div key={w.index} className="flex-1 text-center">
            <div className="font-mono text-xs font-semibold">{w.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" /> Within weekly target
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-over" /> Over weekly target
        </span>
      </div>
    </div>
  );
}

export function Donut({ categories, total }: { categories: Summary["categories"]; total: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative size-48 shrink-0">
        <svg viewBox="0 0 180 180" className="size-full -rotate-90">
          <circle cx="90" cy="90" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="26" />
          {categories.map((cat) => {
            const len = (cat.hours / (total || 1)) * c;
            const el = (
              <circle
                key={cat.name}
                cx="90"
                cy="90"
                r={r}
                fill="none"
                stroke={cat.color}
                strokeWidth="26"
                strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`}
                strokeDashoffset={-offset}
              >
                <title>{`${cat.name}: ${fmtH(cat.hours)} h`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{fmtH(total)}</span>
          <span className="text-xs text-muted">hrs total</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {categories.map((cat) => (
          <li key={cat.name} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-sm">
            <span className="size-2.5 rounded-sm" style={{ background: cat.color }} />
            <span>{cat.name}</span>
            <span className="font-semibold">{fmtH(cat.hours)}</span>
            <span className="w-12 text-right text-muted">{pct(cat.hours, total).toFixed(1)}%</span>
          </li>
        ))}
        {categories.length === 0 && <li className="text-sm text-muted">No hours logged yet.</li>}
      </ul>
    </div>
  );
}
