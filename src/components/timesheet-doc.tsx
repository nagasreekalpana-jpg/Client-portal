import { StatusBadge } from "@/components/ui";
import type { Bundle } from "@/lib/data";
import { dayName, fmtDate, istDate, fmtDay, fmtH, fmtShortRange, pct, summarize } from "@/lib/domain";

/** The client-facing timesheet document (same content as the PDF). */
export function TimesheetDoc({ bundle }: { bundle: Bundle }) {
  const { ts, entries, employee, client, manager } = bundle;
  const s = summarize(ts, entries, employee.weekly_target);
  const phases = [...new Set(entries.map((e) => e.phase_name).filter(Boolean))];
  const shortPhase = (name: string) => name.split(/\s[–-]\s/)[0] || name;

  return (
    <article className="mx-auto max-w-5xl rounded-2xl border border-line bg-surface p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-lg bg-navy text-lg font-bold text-white">
            {(employee.company || "H")[0]}
          </span>
          <div>
            <div className="text-lg font-bold tracking-[0.2em] uppercase">{employee.company}</div>
            <div className="text-xs text-muted">IT Services · Hyderabad, India</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tracking-[0.15em]">TIMESHEET</div>
          <div className="mt-1 font-mono text-xs text-muted">
            {ts.code} · v{ts.version}
          </div>
          <div className="mt-1.5">
            <StatusBadge status={ts.status} dot={false} />
          </div>
        </div>
      </header>

      <dl className="grid gap-x-10 gap-y-3 py-6 text-sm sm:grid-cols-2">
        <div className="space-y-3">
          <Row k="Employee" v={<b>{employee.full_name}</b>} />
          <Row k="Designation" v={employee.designation || "—"} />
          <Row k="Reporting manager" v={manager?.full_name ?? "—"} />
          <Row k="Company" v={employee.company} />
        </div>
        <div className="space-y-3">
          <Row k="Client" v={<b>{client?.company_name ?? "—"}</b>} />
          <Row k="Client contact" v={[client?.contact_name, client?.contact_title].filter(Boolean).join(", ") || "—"} />
          <Row k="Project" v={client?.project_name || "—"} />
          <Row k="Project code" v={<span className="font-mono">{client?.project_code || "—"}</span>} />
          <Row k="Phase(s)" v={phases.join(", ") || "—"} />
          <Row k="Period" v={<b>{`${fmtDate(ts.period_start)} – ${fmtDate(ts.period_end)}`}</b>} />
        </div>
      </dl>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line sm:grid-cols-4">
        {[
          ["Total hours", fmtH(s.total)],
          ["Working days", String(s.loggedDays)],
          ["Avg per day", fmtH(s.avgPerDay)],
          ["Entries", String(entries.length)],
        ].map(([k, v], i) => (
          <div key={k} className={`border-line p-4 ${i ? "border-l" : "bg-primary-soft"}`}>
            <div className="text-xs text-muted">{k}</div>
            <div className="mt-1 text-2xl font-bold">{v}</div>
          </div>
        ))}
      </div>

      <h3 className="mt-8 mb-3 text-sm font-bold tracking-wider uppercase">Daily time entries</h3>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-2">
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2.5">Date</th>
              <th className="px-3 py-2.5">Day</th>
              <th className="px-3 py-2.5">Category</th>
              <th className="px-3 py-2.5">Phase</th>
              <th className="px-3 py-2.5">Task description</th>
              <th className="px-3 py-2.5 text-right">Hours</th>
            </tr>
          </thead>
          <tbody>
            {s.weeks.map((w) => {
              const rows = entries.filter((e) => e.entry_date >= w.start && e.entry_date <= w.end);
              return [
                ...rows.map((e) => (
                  <tr key={e.id} className="border-t border-line align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDay(e.entry_date)}</td>
                    <td className="px-3 py-2 text-muted">{dayName(e.entry_date)}</td>
                    <td className="px-3 py-2">{e.category}</td>
                    <td className="px-3 py-2 text-muted">{shortPhase(e.phase_name)}</td>
                    <td className="px-3 py-2">{e.description}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtH(e.hours)}</td>
                  </tr>
                )),
                <tr key={`w${w.index}`} className="border-t border-line bg-surface-2 font-semibold">
                  <td colSpan={5} className="px-3 py-2">
                    Week {w.index} subtotal · {fmtShortRange(w.start, w.end)}
                  </td>
                  <td className="px-3 py-2 text-right">{fmtH(w.hours)}</td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <table className="w-full overflow-hidden rounded-xl border border-line text-sm">
          <thead className="bg-surface-2">
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2.5">Week</th>
              <th className="px-3 py-2.5">Dates</th>
              <th className="px-3 py-2.5 text-right">Hours</th>
              <th className="px-3 py-2.5 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {s.weeks.map((w) => (
              <tr key={w.index} className="border-t border-line">
                <td className="px-3 py-2 font-semibold">{w.label}</td>
                <td className="px-3 py-2 text-muted">{fmtShortRange(w.start, w.end)}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmtH(w.hours)}</td>
                <td className="px-3 py-2 text-right">{pct(w.hours, s.total).toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="border-t border-line font-bold">
              <td className="px-3 py-2">Total</td>
              <td />
              <td className="px-3 py-2 text-right">{fmtH(s.total)}</td>
              <td className="px-3 py-2 text-right">100%</td>
            </tr>
          </tbody>
        </table>
        <table className="h-fit w-full overflow-hidden rounded-xl border border-line text-sm">
          <tbody>
            {s.categories.map((c) => (
              <tr key={c.name} className="border-t border-line first:border-0">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2.5 rounded-sm" style={{ background: c.color }} />
                    {c.name}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-semibold">{fmtH(c.hours)}</td>
                <td className="px-3 py-2 text-right text-muted">{pct(c.hours, s.total).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex items-center justify-between rounded-xl bg-navy px-5 py-4 text-white">
        <span className="text-sm font-semibold tracking-wider uppercase">Total hours for the period</span>
        <span className="text-2xl font-bold">{fmtH(s.total)} hrs</span>
      </div>

      <div className="mt-10 grid gap-10 sm:grid-cols-2">
        <Sign title={`Reporting manager · ${employee.company}`} name={manager?.full_name ?? "—"} date={ts.approved_at} />
        <Sign
          title={`Shared with client · ${client?.company_name ?? ""}`}
          name={[client?.contact_name, client?.contact_title].filter(Boolean).join(", ") || "—"}
          date={ts.shared_at}
        />
      </div>

      <p className="mt-8 border-t border-line pt-4 text-xs text-muted">
        Generated by TimeSheet Pro · all totals and percentages are calculated automatically from daily entries · {ts.code}
      </p>
    </article>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Sign({ title, name, date }: { title: string; name: string; date: string | null }) {
  return (
    <div>
      <div className="font-mono text-xs font-semibold tracking-wider text-muted uppercase">{title}</div>
      <div className="mt-10 flex items-end justify-between border-t border-ink pt-2 text-sm">
        <b>{name}</b>
        <span className="text-muted">Date: {date ? fmtDate(istDate(date)) : "____________"}</span>
      </div>
    </div>
  );
}
