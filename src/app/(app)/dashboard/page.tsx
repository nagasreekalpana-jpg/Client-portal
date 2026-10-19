import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { AuditTrail, Checks, Stat, StatusBadge, Stepper } from "@/components/ui";
import { submitTimesheet } from "@/lib/actions";
import { getBundle, getCurrentTimesheet, getMe } from "@/lib/data";
import { EDITABLE, fmtH, fmtRange, fmtShortRange, fmtStamp, pct, summarize, todayISO } from "@/lib/domain";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const me = await getMe();
  if (me.role === "manager") redirect("/review");
  const ts = await getCurrentTimesheet(me);
  const { entries, audit, client, manager } = await getBundle(ts);
  const s = summarize(ts, entries, me.weekly_target);

  // default to the week containing today, else the last week
  const today = todayISO();
  const { w } = await searchParams;
  const fallback = s.weeks.find((x) => today >= x.start && today <= x.end) ?? s.weeks.at(-1);
  const week = s.weeks.find((x) => String(x.index) === w) ?? fallback;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(new Date()));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const managerName = manager?.full_name ?? "your manager";

  const statusText = {
    draft: `Your timesheet is a draft. Review the entries, then submit it to ${managerName}.`,
    returned: `${managerName} sent this back for changes. Fix the entries and resubmit.`,
    submitted: `Submitted ${fmtStamp(ts.submitted_at)}. Waiting for ${managerName} to review.`,
    approved: `Approved ${fmtStamp(ts.approved_at)}. ${managerName} will share it with the client.`,
    shared: `Shared with ${ts.shared_to ?? "the client"} on ${fmtStamp(ts.shared_at)}. This period is closed.`,
  }[ts.status];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
            {greet}, {me.full_name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Timesheet for {client?.project_name || "your project"} · {fmtRange(ts.period_start, ts.period_end)}
          </p>
        </div>
        <span className="font-mono text-sm text-muted">{ts.code}</span>
      </div>

      {ts.status === "returned" && ts.return_comment && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm">
          <div className="font-semibold text-danger">Sent back by {managerName}</div>
          <p className="mt-1 text-ink">“{ts.return_comment}”</p>
        </div>
      )}

      <section className="card p-5 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">Timesheet status</h2>
            <StatusBadge status={ts.status} />
            <span className="font-mono text-xs text-muted">v{ts.version}</span>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-4">
            <p className="max-w-md text-sm text-muted">{statusText}</p>
            {EDITABLE.includes(ts.status) && (
              <ActionButton action={submitTimesheet.bind(null, ts.id)}>{ts.status === "returned" ? "Resubmit" : "Review & submit"}</ActionButton>
            )}
          </div>
        </div>
        <Stepper status={ts.status} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Period total" value={fmtH(s.total)} unit="hrs" hint={`${entries.length} entries · auto-calculated`} />
        {week ? (
          <Stat
            label={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Week vs {fmtH(week.target)} h target</span>
                <span className="flex gap-1">
                  {s.weeks.map((x) => (
                    <Link
                      key={x.index}
                      href={`?w=${x.index}`}
                      scroll={false}
                      className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${x.index === week.index ? "bg-primary text-white" : "text-muted hover:bg-surface-2"}`}
                    >
                      {x.label}
                    </Link>
                  ))}
                </span>
              </div>
            }
            value={fmtH(week.hours)}
            unit={`/ ${fmtH(week.target)} h`}
            hint={`${fmtShortRange(week.start, week.end)} · ${
              week.hours >= week.target ? `${fmtH(week.hours - week.target)} h over target` : `${fmtH(week.target - week.hours)} h below target`
            }${week.workdays < 5 ? ` (${week.workdays}-day week)` : ""}`}
          >
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct(week.hours, week.target))}%` }} />
            </div>
          </Stat>
        ) : (
          <Stat label="Week" value="—" />
        )}
        <Stat
          label="Weekdays logged"
          value={String(s.loggedDays)}
          unit={`/ ${s.weekdays.length}`}
          hint={s.missingDays.length ? `${s.missingDays.length} weekday(s) still missing` : "No missing weekdays"}
        />
        <Stat label="Average per day" value={fmtH(s.avgPerDay)} unit="hrs" hint={`Max 12 h/day · ${s.overDays.length} days over`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Submission checks</h2>
            <Link href="/time-entry" className="text-sm font-semibold text-primary">
              Open Time Entry →
            </Link>
          </div>
          <Checks checks={s.checks} />
        </div>
        <AuditTrail events={audit} limit={8} />
      </section>
    </div>
  );
}
