"use client";

import { useMemo, useState, useTransition } from "react";
import { ActionButton } from "@/components/action-button";
import { StatusBadge } from "@/components/ui";
import { addEntry, deleteEntry, submitTimesheet, updateEntry } from "@/lib/actions";
import {
  CATEGORIES,
  EDITABLE,
  MAX_DAY_HOURS,
  categoryColor,
  dayName,
  dayTotals,
  fmtDay,
  fmtH,
  fmtShortRange,
  isWeekday,
  round2,
  todayISO,
  type Entry,
  type Phase,
  type Summary,
  type Timesheet,
} from "@/lib/domain";

type Props = {
  ts: Timesheet;
  entries: Entry[];
  phases: Phase[];
  weeks: Summary["weeks"];
  total: number;
  checks: Summary["checks"];
  canSubmit: boolean;
  managerName: string;
};

type Draft = { entry_date: string; category: string; phase_id: string | null; description: string; hours: string };

function defaultDate(ts: Timesheet) {
  const t = todayISO();
  if (t >= ts.period_start && t <= ts.period_end && isWeekday(t)) return t;
  return t > ts.period_end ? ts.period_end : ts.period_start;
}

export function TimeEntry({ ts, entries, phases, weeks, total, checks, canSubmit, managerName }: Props) {
  const editable = EDITABLE.includes(ts.status);
  const currentPhase = phases.find((p) => p.is_current) ?? phases[0];
  const [form, setForm] = useState<Draft>({
    entry_date: defaultDate(ts),
    category: "Development",
    phase_id: currentPhase?.id ?? null,
    description: "",
    hours: "",
  });
  const [week, setWeek] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const totals = useMemo(() => dayTotals(entries), [entries]);
  const logged = totals.get(form.entry_date) ?? 0;
  const failing = checks.filter((c) => !c.ok);

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await addEntry(ts.id, { ...form, hours: Number(form.hours) });
      if (r.error) setError(r.error);
      else setForm((f) => ({ ...f, description: "", hours: "" }));
    });
  }

  const shownWeeks = weeks.filter((w) => week === null || w.index === week);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Daily time entry</h1>
          <p className="mt-1 text-sm text-muted">
            Weekdays only · enter any number of hours (decimals like 7.75 are fine) · day total must stay within {MAX_DAY_HOURS} h to submit
          </p>
        </div>
        {editable && (
          <ActionButton action={submitTimesheet.bind(null, ts.id)}>
            {ts.status === "returned" ? "Resubmit for approval" : "Submit for approval"}
          </ActionButton>
        )}
      </div>

      {editable && (
        <form onSubmit={submitAdd} className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Add an entry</h2>
            {form.entry_date && (
              <span className={`text-sm ${logged > MAX_DAY_HOURS ? "text-danger" : "text-muted"}`}>
                {dayName(form.entry_date)} {fmtDay(form.entry_date)} · already logged {fmtH(logged)} h
                {logged <= MAX_DAY_HOURS ? `, ${fmtH(MAX_DAY_HOURS - logged)} h left today` : " — over the daily limit"}
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.1fr_1.1fr_1.6fr_0.8fr_auto] lg:items-end">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                min={ts.period_start}
                max={ts.period_end}
                value={form.entry_date}
                onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Phase</label>
              <select className="input" value={form.phase_id ?? ""} onChange={(e) => setForm({ ...form, phase_id: e.target.value || null })}>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Task description</label>
              <input className="input" placeholder="What did you work on?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div>
              <label className="label">Hours</label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0.01"
                className="input text-right"
                placeholder="e.g. 7.5"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
                required
              />
            </div>
            <button className="btn-primary h-[38px]" disabled={pending}>
              {pending ? "Adding…" : "+ Add entry"}
            </button>
          </div>
          {form.entry_date && !isWeekday(form.entry_date) && <p className="mt-3 text-sm text-danger">That date is a weekend — weekdays only.</p>}
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </form>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <WeekChip active={week === null} onClick={() => setWeek(null)} title="All weeks" hours={total} hint="Period total" />
        {weeks.map((w) => (
          <WeekChip key={w.index} active={week === w.index} onClick={() => setWeek(w.index)} title={`Week ${w.index}`} hours={w.hours} hint={fmtShortRange(w.start, w.end)} />
        ))}
      </div>

      {editable ? (
        canSubmit ? (
          <div className="rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success">
            All weekdays logged, no day over {MAX_DAY_HOURS} h — ready to submit to {managerName}.
          </div>
        ) : (
          <div className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
            <span className="font-semibold">Not ready to submit:</span> {failing.map((c) => `${c.label} (${c.hint})`).join(" · ")}
          </div>
        )
      ) : (
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
          {ts.status === "submitted" && "Submitted to your manager — entries are locked until it is approved or sent back."}
          {ts.status === "approved" && "Approved by your manager — entries are locked."}
          {ts.status === "shared" && "Shared with the client — this period is closed."}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Date</th>
              <th className="px-2 py-3">Day</th>
              <th className="px-2 py-3">Wk</th>
              <th className="px-2 py-3">Category</th>
              <th className="px-2 py-3">Phase</th>
              <th className="px-2 py-3">Task description</th>
              <th className="px-2 py-3 text-right">Hours</th>
              <th className="px-2 py-3 text-right">Day total</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {shownWeeks.map((w) => {
              const rows = entries.filter((e) => e.entry_date >= w.start && e.entry_date <= w.end);
              return (
                <WeekRows
                  key={w.index}
                  label={`Week ${w.index}`}
                  range={fmtShortRange(w.start, w.end)}
                  hours={w.hours}
                  weekLabel={w.label}
                  rows={rows}
                  totals={totals}
                  ts={ts}
                  phases={phases}
                  editable={editable}
                  editing={editing}
                  setEditing={setEditing}
                />
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted">
                  No entries yet. Add your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeekChip({ active, onClick, title, hours, hint }: { active: boolean; onClick: () => void; title: string; hours: number; hint: string }) {
  return (
    <button onClick={onClick} className={`rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary-soft" : "border-line bg-surface hover:bg-surface-2"}`}>
      <div className="text-xs text-muted">{title}</div>
      <div className="mt-0.5 text-xl font-bold">
        {fmtH(hours)} <span className="text-xs font-normal text-muted">h</span>
      </div>
      <div className="text-xs text-muted">{hint}</div>
    </button>
  );
}

function WeekRows({
  label,
  range,
  hours,
  weekLabel,
  rows,
  totals,
  ts,
  phases,
  editable,
  editing,
  setEditing,
}: {
  label: string;
  range: string;
  hours: number;
  weekLabel: string;
  rows: Entry[];
  totals: Map<string, number>;
  ts: Timesheet;
  phases: Phase[];
  editable: boolean;
  editing: string | null;
  setEditing: (id: string | null) => void;
}) {
  return (
    <>
      <tr className="border-b border-line bg-surface-2">
        <td colSpan={9} className="px-4 py-2.5">
          <span className="font-semibold">{label}</span> <span className="text-muted">· {range}</span>
          <span className="float-right font-mono text-xs text-muted">{fmtH(hours)} h</span>
        </td>
      </tr>
      {rows.length === 0 && (
        <tr className="border-b border-line">
          <td colSpan={9} className="px-4 py-3 text-xs text-muted">
            Nothing logged this week.
          </td>
        </tr>
      )}
      {rows.map((e, i) => {
        const lastOfDay = rows[i + 1]?.entry_date !== e.entry_date;
        const dayTotal = totals.get(e.entry_date) ?? 0;
        return editing === e.id ? (
          <EditRow key={e.id} entry={e} ts={ts} phases={phases} onDone={() => setEditing(null)} />
        ) : (
          <tr key={e.id} className="group border-b border-line align-top last:border-0">
            <td className="px-4 py-3 font-semibold whitespace-nowrap">{fmtDay(e.entry_date)}</td>
            <td className="px-2 py-3 text-muted">{dayName(e.entry_date)}</td>
            <td className="px-2 py-3 font-mono text-xs text-muted">{weekLabel}</td>
            <td className="px-2 py-3">
              <span className="inline-flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-sm" style={{ background: categoryColor(e.category) }} />
                <span className="max-w-[180px] truncate" title={e.category}>
                  {e.category}
                </span>
              </span>
            </td>
            <td className="max-w-[160px] truncate px-2 py-3 text-muted" title={e.phase_name}>
              {e.phase_name || "—"}
            </td>
            <td className="max-w-[260px] px-2 py-3">{e.description}</td>
            <td className="px-2 py-3 text-right font-semibold">{fmtH(e.hours)}</td>
            <td className={`px-2 py-3 text-right font-semibold ${dayTotal > MAX_DAY_HOURS ? "text-danger" : ""}`}>{lastOfDay ? fmtH(dayTotal) : ""}</td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={ts.status} dot={false} />
                {editable && (
                  <span className="flex gap-1 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
                    <button className="rounded px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary-soft" onClick={() => setEditing(e.id)}>
                      Edit
                    </button>
                    <DeleteButton id={e.id} />
                  </span>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="rounded px-1.5 py-0.5 text-xs font-semibold text-danger hover:bg-danger-soft"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this entry?")) return;
        start(async () => {
          const r = await deleteEntry(id);
          if (r.error) alert(r.error);
        });
      }}
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}

function EditRow({ entry, ts, phases, onDone }: { entry: Entry; ts: Timesheet; phases: Phase[]; onDone: () => void }) {
  const [d, setD] = useState({ ...entry, hours: String(entry.hours) });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <tr className="border-b border-line bg-primary-soft/40">
      <td className="px-4 py-2" colSpan={2}>
        <input type="date" className="input" min={ts.period_start} max={ts.period_end} value={d.entry_date} onChange={(e) => setD({ ...d, entry_date: e.target.value })} />
      </td>
      <td />
      <td className="px-2 py-2">
        <select className="input" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>
          {CATEGORIES.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <select className="input" value={d.phase_id ?? ""} onChange={(e) => setD({ ...d, phase_id: e.target.value || null })}>
          {phases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input className="input" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        {error && <div className="mt-1 text-xs text-danger">{error}</div>}
      </td>
      <td className="px-2 py-2">
        <input type="number" step="any" min="0.01" className="input w-20 text-right" value={d.hours} onChange={(e) => setD({ ...d, hours: e.target.value })} />
      </td>
      <td colSpan={2} className="px-4 py-2">
        <div className="flex gap-2">
          <button
            className="btn-primary btn-sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await updateEntry(entry.id, {
                  entry_date: d.entry_date,
                  category: d.category,
                  phase_id: d.phase_id,
                  description: d.description,
                  hours: round2(Number(d.hours)),
                });
                if (r.error) setError(r.error);
                else onDone();
              })
            }
          >
            Save
          </button>
          <button className="btn-ghost btn-sm" onClick={onDone}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}
