import { STATUS_LABEL, fmtStamp, initials, type AuditEvent, type Status } from "@/lib/domain";

const STATUS_STYLE: Record<Status, string> = {
  draft: "bg-surface-2 text-muted border-line",
  submitted: "bg-primary-soft text-primary border-transparent",
  returned: "bg-danger-soft text-danger border-transparent",
  approved: "bg-success-soft text-success border-transparent",
  shared: "bg-warn-soft text-warn border-transparent",
};

export function StatusBadge({ status, dot = true }: { status: Status; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const s = size === "sm" ? "size-8 text-[11px]" : "size-9 text-xs";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary ${s}`}>
      {initials(name)}
    </span>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, unit, hint, children }: { label: React.ReactNode; value: string; unit?: string; hint?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight sm:text-4xl">{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {children}
      {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
    </div>
  );
}

const STEPS = ["Draft", "Submitted", "Manager Approved", "Shared with client"];

export function Stepper({ status }: { status: Status }) {
  const at = { draft: 0, returned: 0, submitted: 1, approved: 2, shared: 3 }[status];
  return (
    <ol className="grid grid-cols-4 gap-2">
      {STEPS.map((s, i) => {
        const done = i < at || status === "shared";
        const active = i === at && status !== "shared";
        return (
          <li key={s} className="relative">
            {i < STEPS.length - 1 && (
              <span className={`absolute left-8 right-0 top-3.5 h-0.5 ${i < at ? "bg-primary" : "bg-line"}`} />
            )}
            <span
              className={`relative z-10 inline-flex size-7 items-center justify-center rounded-full border text-xs font-semibold ${
                done ? "border-primary bg-primary text-white" : active ? "border-primary bg-primary text-white ring-4 ring-primary/15" : "border-line bg-surface text-muted"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <div className={`mt-2 text-xs font-medium sm:text-sm ${active || done ? "text-ink" : "text-muted"}`}>
              {i === 0 && status === "returned" ? "Returned" : s}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Checks({ checks }: { checks: { ok: boolean; label: string; hint: string }[] }) {
  return (
    <ul className="space-y-3">
      {checks.map((c) => (
        <li key={c.label} className="flex gap-3">
          <span
            className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              c.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
            }`}
          >
            {c.ok ? "✓" : "!"}
          </span>
          <div>
            <div className="text-sm font-medium">{c.label}</div>
            <div className="text-xs text-muted">{c.hint}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AuditTrail({ events, limit }: { events: AuditEvent[]; limit?: number }) {
  const list = limit ? events.slice(0, limit) : events;
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Audit trail</h2>
        <span className="text-xs text-muted">{events.length} events</span>
      </div>
      {list.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
      <ol className="relative space-y-4 border-l border-line pl-5">
        {list.map((e, i) => (
          <li key={e.id} className="relative">
            <span className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full ${i === 0 ? "bg-primary" : "bg-line"}`} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{e.action}</span>
              {e.status && <StatusBadge status={e.status} dot={false} />}
            </div>
            {e.detail && <div className="mt-0.5 text-xs text-ink/80">{e.detail}</div>}
            <div className="mt-0.5 text-xs text-muted">
              {e.actor_name} · {e.actor_role} · {fmtStamp(e.created_at)}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <h2 className="font-semibold">{title}</h2>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}
