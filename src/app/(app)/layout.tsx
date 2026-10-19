import { Sidebar, ThemeToggle } from "@/components/shell";
import { Avatar, StatusBadge } from "@/components/ui";
import { signOut } from "@/lib/actions";
import { getBundle, getCurrentTimesheet, getMe, getTeamSheets } from "@/lib/data";
import { fmtH, fmtRange, sumHours } from "@/lib/domain";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();

  let periodCard: React.ReactNode;
  let header: React.ReactNode;
  let badge = 0;

  if (me.role === "employee") {
    const ts = await getCurrentTimesheet(me);
    const { entries, client, phases } = await getBundle(ts);
    const current = phases.find((p) => p.is_current);
    periodCard = (
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <div className="font-mono text-[11px] uppercase tracking-widest text-muted">Current period</div>
        <div className="mt-1.5 text-sm font-semibold">{fmtRange(ts.period_start, ts.period_end)}</div>
        <div className="mt-1 text-xs text-muted">
          {client?.project_code || "—"} · {fmtH(sumHours(entries))} h
        </div>
        <div className="mt-2">
          <StatusBadge status={ts.status} />
        </div>
      </div>
    );
    header = (
      <div className="min-w-0">
        <div className="truncate font-semibold">{client?.project_name || "No project yet"}</div>
        <div className="truncate text-xs text-muted">
          {[client?.company_name, client?.project_code, current?.name].filter(Boolean).join(" · ")}
        </div>
      </div>
    );
  } else {
    const sheets = await getTeamSheets(me.id);
    badge = sheets.filter((s) => s.ts.status === "submitted").length;
    const reports = new Set(sheets.map((s) => s.employee.id)).size;
    periodCard = (
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <div className="font-mono text-[11px] uppercase tracking-widest text-muted">Your team</div>
        <div className="mt-1.5 text-sm font-semibold">{reports} direct report{reports === 1 ? "" : "s"}</div>
        <div className="mt-1 text-xs text-muted">{badge} awaiting your review</div>
      </div>
    );
    header = (
      <div className="min-w-0">
        <div className="truncate font-semibold">Manager workspace</div>
        <div className="truncate text-xs text-muted">Review, approve and share your team&apos;s timesheets</div>
      </div>
    );
  }

  const user = (
    <div className="flex items-center gap-3 px-1">
      <Avatar name={me.full_name} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{me.full_name}</div>
        <div className="truncate text-xs text-muted">{me.designation || (me.role === "manager" ? "Reporting Manager" : "Employee")}</div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar role={me.role} badge={badge} periodCard={periodCard} user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur sm:px-8">
          {header}
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted sm:inline">
              {me.role === "manager" ? "Manager" : "Employee"}
            </span>
            <ThemeToggle />
            <form action={signOut}>
              <button className="btn-ghost btn-sm">Sign out</button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 pb-20 sm:px-8 lg:pb-8">{children}</main>
      </div>
    </div>
  );
}
