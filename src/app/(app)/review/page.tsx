import Link from "next/link";
import { redirect } from "next/navigation";
import { TimesheetDoc } from "@/components/timesheet-doc";
import { AuditTrail, Avatar, Checks, Empty, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { getBundle, getMe, getTeamSheets, resolveSheet } from "@/lib/data";
import { fmtH, fmtRange, fmtStamp, summarize } from "@/lib/domain";
import { ReviewActions } from "./review-actions";

export default async function Review({ searchParams }: { searchParams: Promise<{ ts?: string }> }) {
  const me = await getMe();
  if (me.role !== "manager") redirect("/dashboard");
  const { ts: tsParam } = await searchParams;
  const sheets = await getTeamSheets(me.id);
  const selected = await resolveSheet(me, tsParam);
  const bundle = selected ? await getBundle(selected) : null;

  const count = (st: string) => sheets.filter((s) => s.ts.status === st).length;
  // queue: everything not yet closed, plus the latest shared ones for context
  const queue = sheets.filter((s, i) => s.ts.status !== "shared" || i < 6);

  return (
    <div className="space-y-5">
      <PageHeader title="Review queue" subtitle="Timesheets from your reports" />

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Awaiting your review" value={String(count("submitted"))} />
        <Stat label="Approved, ready to share" value={String(count("approved"))} />
        <Stat label="Shared with client" value={String(count("shared"))} />
      </section>

      {sheets.length === 0 ? (
        <Empty title="No timesheets yet">When your reports sign up and pick you as their manager, their timesheets show here.</Empty>
      ) : (
        <section className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                <th className="px-5 py-3">Employee</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Period</th>
                <th className="px-3 py-3 text-right">Hours</th>
                <th className="px-3 py-3">Submitted</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {queue.map((s) => {
                const active = s.ts.id === selected?.id;
                return (
                  <tr key={s.ts.id} className={`border-b border-line last:border-0 ${active ? "bg-primary-soft/60" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.employee.full_name} size="sm" />
                        <div>
                          <div className="font-semibold">{s.employee.full_name}</div>
                          <div className="text-xs text-muted">{s.employee.designation}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{s.client?.project_name || "—"}</td>
                    <td className="px-3 py-3 text-muted">{fmtRange(s.ts.period_start, s.ts.period_end)}</td>
                    <td className="px-3 py-3 text-right font-semibold">{fmtH(s.hours)}</td>
                    <td className="px-3 py-3 text-muted">{s.ts.submitted_at ? fmtStamp(s.ts.submitted_at) : "Not submitted"}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={s.ts.status} dot={false} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/review?ts=${s.ts.id}`} scroll={false} className="btn-ghost btn-sm">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {bundle && (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {bundle.employee.full_name} · {fmtH(summarize(bundle.ts, bundle.entries).total)} h
                  </h2>
                  <div className="font-mono text-xs text-muted">
                    {bundle.ts.code} · v{bundle.ts.version}
                  </div>
                </div>
                <StatusBadge status={bundle.ts.status} />
              </div>
              <Checks checks={summarize(bundle.ts, bundle.entries, bundle.employee.weekly_target).checks} />
              {bundle.ts.status === "returned" && bundle.ts.return_comment && (
                <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm">
                  <b className="text-danger">You sent this back:</b> “{bundle.ts.return_comment}”
                </p>
              )}
              <div className="mt-5 border-t border-line pt-5">
                <ReviewActions ts={bundle.ts} firstName={bundle.employee.full_name.split(" ")[0]} />
              </div>
            </div>
            <AuditTrail events={bundle.audit} limit={8} />
          </section>
          <TimesheetDoc bundle={bundle} />
        </>
      )}
    </div>
  );
}
