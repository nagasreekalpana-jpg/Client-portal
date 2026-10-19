import { Donut, WeekBars } from "@/components/charts";
import { SheetPicker } from "@/components/sheet-picker";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { fmtH, fmtRange, fmtShortRange, pct, summarize } from "@/lib/domain";
import { loadPageSheet } from "@/lib/page-sheet";

export default async function WeeklySummary({ searchParams }: { searchParams: Promise<{ ts?: string }> }) {
  const { ts: tsParam } = await searchParams;
  const { bundle, options } = await loadPageSheet(tsParam);
  if (!bundle) return <Empty title="No timesheets yet">Your reports haven&apos;t started a timesheet.</Empty>;

  const { ts, entries, employee } = bundle;
  const s = summarize(ts, entries, employee.weekly_target);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Weekly summary"
        subtitle={`${options.length ? `${employee.full_name} · ` : ""}${fmtRange(ts.period_start, ts.period_end)} · all figures calculated from daily entries`}
      >
        <SheetPicker options={options} value={ts.id} />
      </PageHeader>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total hours" value={fmtH(s.total)} />
        <Stat label="Average per week" value={fmtH(s.avgPerWeek)} />
        <Stat label="Peak week" value={s.peakWeek ? fmtH(s.peakWeek.hours) : "—"} unit={s.peakWeek?.label} />
        <Stat label="Top category" value={s.topCategory ? `${pct(s.topCategory.hours, s.total).toFixed(1)}%` : "—"} hint={s.topCategory?.name} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-6 font-semibold">Hours by week</h2>
          <WeekBars weeks={s.weeks} weeklyTarget={employee.weekly_target} />
        </div>
        <div className="card p-5">
          <h2 className="mb-6 font-semibold">Hours by category</h2>
          <Donut categories={s.categories} total={s.total} />
        </div>
      </section>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-muted">
              <th className="px-5 py-3">Week</th>
              <th className="px-3 py-3">Dates</th>
              <th className="px-3 py-3 text-right">Days</th>
              <th className="px-3 py-3 text-right">Hours</th>
              <th className="px-5 py-3">% of total</th>
            </tr>
          </thead>
          <tbody>
            {s.weeks.map((w) => (
              <tr key={w.index} className="border-b border-line">
                <td className="px-5 py-3 font-mono font-semibold">{w.label}</td>
                <td className="px-3 py-3 text-muted">{fmtShortRange(w.start, w.end)}</td>
                <td className="px-3 py-3 text-right">{w.days}</td>
                <td className="px-3 py-3 text-right font-semibold">{fmtH(w.hours)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct(w.hours, s.total)}%` }} />
                    </div>
                    <span className="w-14 text-right">{pct(w.hours, s.total).toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-5 py-3">Total</td>
              <td />
              <td className="px-3 py-3 text-right">{s.loggedDays}</td>
              <td className="px-3 py-3 text-right">{fmtH(s.total)}</td>
              <td className="px-5 py-3 text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
