import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { getBundle, getMe, getTeamSheets, getTimesheet } from "@/lib/data";
import { fmtH, fmtRange, fmtStamp } from "@/lib/domain";
import { SendForm } from "./send-form";

export default async function SendToClient({ searchParams }: { searchParams: Promise<{ ts?: string }> }) {
  const me = await getMe();
  if (me.role !== "manager") redirect("/dashboard");
  const { ts: tsParam } = await searchParams;
  const sheets = await getTeamSheets(me.id);
  const ready = sheets.filter((s) => s.ts.status === "approved");
  const shared = sheets.filter((s) => s.ts.status === "shared").slice(0, 10);

  const pick = (tsParam && sheets.find((s) => s.ts.id === tsParam)) || ready[0];
  const ts = pick ? await getTimesheet(pick.ts.id) : null;
  const bundle = ts ? await getBundle(ts) : null;

  return (
    <div className="space-y-5">
      <PageHeader title="Send to client" subtitle="Share the manager-approved timesheet PDF with the client" />

      {ready.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {ready.map((s) => (
            <Link key={s.ts.id} href={`/send-to-client?ts=${s.ts.id}`} className={s.ts.id === pick?.ts.id ? "btn-primary btn-sm" : "btn-ghost btn-sm"}>
              {s.employee.full_name} · {fmtH(s.hours)} h
            </Link>
          ))}
        </div>
      )}

      {!bundle ? (
        <Empty title="Nothing to send">Approved timesheets appear here, ready to share with the client.</Empty>
      ) : bundle.ts.status !== "approved" ? (
        <div className="card p-6">
          <h2 className="font-semibold">{bundle.ts.status === "shared" ? "Already shared" : "Waiting for manager approval"}</h2>
          <p className="mt-1 text-sm text-muted">
            {bundle.ts.status === "shared"
              ? `Sent to ${bundle.ts.shared_to} on ${fmtStamp(bundle.ts.shared_at)}.`
              : "The client email unlocks once the timesheet is approved. Current status:"}
          </p>
          <div className="mt-3">
            <StatusBadge status={bundle.ts.status} />
          </div>
        </div>
      ) : (
        <SendForm
          tsId={bundle.ts.id}
          code={bundle.ts.code}
          version={bundle.ts.version}
          to={bundle.client?.contact_email ?? ""}
          contactName={bundle.client?.contact_name ?? ""}
          clientName={bundle.client?.company_name ?? ""}
          projectName={bundle.client?.project_name ?? ""}
          employeeName={bundle.employee.full_name}
          period={fmtRange(bundle.ts.period_start, bundle.ts.period_end)}
          hours={fmtH(bundle.entries.reduce((a, e) => a + e.hours, 0))}
          managerName={me.full_name}
          company={me.company}
        />
      )}

      {shared.length > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="border-b border-line px-5 py-3 font-semibold">Recently shared</h2>
          <table className="w-full min-w-[640px] text-sm">
            <tbody>
              {shared.map((s) => (
                <tr key={s.ts.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.employee.full_name} size="sm" />
                      {s.employee.full_name}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted">{fmtRange(s.ts.period_start, s.ts.period_end)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{fmtH(s.hours)} h</td>
                  <td className="px-3 py-3 text-muted">{s.ts.shared_to}</td>
                  <td className="px-5 py-3 text-muted">{fmtStamp(s.ts.shared_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
