import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { Downloads } from "@/components/downloads";
import { Avatar, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { startNextPeriod } from "@/lib/actions";
import { getClients, getCurrentTimesheet, getEntries, getMe, getTeamSheets, getTimesheets } from "@/lib/data";
import { fmtH, fmtRange, fmtStamp, sumHours, type Profile, type Timesheet } from "@/lib/domain";

type Row = { ts: Timesheet; hours: number; project: string; employee?: Profile };

export default async function History() {
  const me = await getMe();
  let rows: Row[];
  let currentId: string | null = null;

  if (me.role === "employee") {
    currentId = (await getCurrentTimesheet(me)).id;
    const sheets = await getTimesheets(me.id);
    const clients = await getClients(me.id);
    rows = await Promise.all(
      sheets.map(async (ts) => ({
        ts,
        hours: sumHours(await getEntries(ts.id)),
        project: clients.find((c) => c.id === ts.client_id)?.project_code || "—",
      })),
    );
  } else {
    rows = (await getTeamSheets(me.id)).map((s) => ({ ts: s.ts, hours: s.hours, project: s.client?.project_code || "—", employee: s.employee }));
  }

  const latest = rows[0]?.ts;
  const canStartNext = me.role === "employee" && latest?.status === "shared";

  return (
    <div className="space-y-5">
      <PageHeader title="History" subtitle={me.role === "employee" ? `${me.full_name} · past timesheet periods` : "Your team's timesheet periods"}>
        {canStartNext && (
          <ActionButton action={startNextPeriod} done="New period opened.">
            Start next period
          </ActionButton>
        )}
      </PageHeader>
      {rows.length === 0 ? (
        <Empty title="No timesheets yet" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                {me.role === "manager" && <th className="px-5 py-3">Employee</th>}
                <th className="px-5 py-3">Period</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3 text-right">Hours</th>
                <th className="px-3 py-3">Ver.</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Submitted</th>
                <th className="px-3 py-3">Manager approved</th>
                <th className="px-3 py-3">Shared with client</th>
                <th className="px-5 py-3 text-right">Downloads</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ ts, hours, project, employee }) => (
                <tr key={ts.id} className="border-b border-line last:border-0">
                  {employee && (
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={employee.full_name} size="sm" />
                        <span className="font-medium">{employee.full_name}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <Link href={`/preview?ts=${ts.id}`} className="font-semibold hover:text-primary">
                      {fmtRange(ts.period_start, ts.period_end)}
                    </Link>
                    {ts.id === currentId && <div className="text-xs font-medium text-primary">Current</div>}
                  </td>
                  <td className="px-3 py-3 text-muted">{project}</td>
                  <td className="px-3 py-3 text-right font-semibold">{fmtH(hours)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted">v{ts.version}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={ts.status} dot={false} />
                  </td>
                  <td className="px-3 py-3 text-muted">{fmtStamp(ts.submitted_at)}</td>
                  <td className="px-3 py-3 text-muted">
                    {fmtStamp(ts.approved_at)}
                    {ts.returned_count > 0 && (
                      <div className="text-xs">
                        (sent back {ts.returned_count === 1 ? "once" : `${ts.returned_count} times`})
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted">{fmtStamp(ts.shared_at)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <Downloads timesheetId={ts.id} small />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
