"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addClient,
  addPhase,
  removeClient,
  removePhase,
  renamePhase,
  setCurrentPhase,
  updateClient,
  updatePhaseHours,
  useClient as selectClient,
} from "@/lib/actions";
import {
  MAX_DAY_HOURS,
  dayName,
  dayTotals,
  fmtDay,
  fmtH,
  round2,
  sumHours,
  type Client,
  type Entry,
  type Phase,
  type Timesheet,
} from "@/lib/domain";

type Props = {
  ts: Timesheet;
  clients: Client[];
  selectedId: string | null;
  phases: Phase[];
  entries: Entry[];
  canEditSetup: boolean;
  canEditHours: boolean;
};

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
    });
  return { pending, error, run };
}

export function ProjectClient({ ts, clients, selectedId, phases, entries, canEditSetup, canEditHours }: Props) {
  const { pending, error, run } = useRun();
  // inline field saves run separately so they never disable the action buttons
  const fields = useRun();
  const selected = clients.find((c) => c.id === selectedId) ?? clients[0];
  const sheetLocked = !["draft", "returned"].includes(ts.status);
  const [newPhase, setNewPhase] = useState("");
  const [editing, setEditing] = useState<Phase | null>(null);

  return (
    <div className="space-y-5">
      {(error || fields.error) && <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error || fields.error}</div>}

      {canEditSetup && (
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Clients</h2>
              <p className="text-sm text-muted">Add every client you bill. The selected one is used on this timesheet and email.</p>
            </div>
            <button className="btn-primary" disabled={pending} onClick={() => run(addClient)}>
              + Add client
            </button>
          </div>
          <ul className="space-y-2">
            {clients.map((c) => {
              const isSel = c.id === selected?.id;
              return (
                <li
                  key={c.id}
                  className={`grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[1.4fr_1fr_1.3fr_auto] ${isSel ? "border-primary bg-primary-soft" : "border-line"}`}
                >
                  <div>
                    <div className="font-semibold">{c.company_name || "Untitled client"}</div>
                    <div className="text-xs text-muted">
                      {[c.project_name, c.project_code].filter(Boolean).join(" · ") || "No project yet"}
                    </div>
                  </div>
                  <div className="text-sm text-muted">{[c.contact_name, c.contact_title].filter(Boolean).join(", ") || "—"}</div>
                  <div className="truncate text-sm text-muted">{c.contact_email || "—"}</div>
                  <div className="flex gap-2">
                    {isSel ? (
                      <span className="btn-primary btn-sm pointer-events-none">Selected</span>
                    ) : (
                      <button
                        className="btn-ghost btn-sm"
                        disabled={pending || sheetLocked}
                        title={sheetLocked ? "The timesheet is locked" : undefined}
                        onClick={() => run(() => selectClient(ts.id, c.id))}
                      >
                        Use for timesheet
                      </button>
                    )}
                    <button
                      className="btn-ghost btn-sm text-danger"
                      disabled={pending || clients.length <= 1}
                      onClick={() => confirm(`Remove ${c.company_name}?`) && run(() => removeClient(c.id))}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {selected && (
        <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="card p-5">
            <h2 className="mb-4 font-semibold">{canEditSetup ? "Selected client details" : "Client"}</h2>
            <div className="grid gap-4 sm:grid-cols-2" key={selected.id}>
              <Field client={selected} field="company_name" label="Client company name" full editable={canEditSetup} run={fields.run} />
              <Field client={selected} field="contact_name" label="Contact name" editable={canEditSetup} run={fields.run} />
              <Field client={selected} field="contact_title" label="Contact title" editable={canEditSetup} run={fields.run} />
              <Field client={selected} field="contact_email" label="Contact email (timesheet is sent here)" type="email" full editable={canEditSetup} run={fields.run} />
            </div>
          </div>
          <div className="card h-fit p-5">
            <h2 className="mb-4 font-semibold">Project</h2>
            <div className="grid gap-4" key={selected.id}>
              <Field client={selected} field="project_name" label="Project name" editable={canEditSetup} run={fields.run} />
              <Field client={selected} field="project_code" label="Project code" mono editable={canEditSetup} run={fields.run} />
            </div>
          </div>
        </section>
      )}

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Project phases</h2>
          <p className="text-sm text-muted">Each time entry is tagged with a phase. The current phase is the default for new entries.</p>
        </div>
        <ul className="space-y-2">
          {phases.map((p, i) => {
            const hours = sumHours(entries.filter((e) => e.phase_id === p.id));
            return (
              <li
                key={p.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${p.is_current ? "border-primary bg-primary-soft" : "border-line"}`}
              >
                <span className="w-6 text-center font-mono text-sm text-muted">{i + 1}</span>
                <input
                  className="input min-w-48 flex-1"
                  defaultValue={p.name}
                  disabled={!canEditSetup}
                  onBlur={(e) => e.target.value.trim() !== p.name && fields.run(() => renamePhase(p.id, e.target.value))}
                />
                <span className="w-20 text-right text-sm font-semibold">{fmtH(hours)} h</span>
                <button className="btn-ghost btn-sm" onClick={() => setEditing(p)}>
                  {canEditHours ? "Edit hours" : "View hours"}
                </button>
                {canEditSetup && (
                  <>
                    {p.is_current ? (
                      <span className="btn-primary btn-sm pointer-events-none">Current phase</span>
                    ) : (
                      <button className="btn-ghost btn-sm" disabled={pending} onClick={() => run(() => setCurrentPhase(p.id))}>
                        Set as current
                      </button>
                    )}
                    <button className="btn-ghost btn-sm text-danger" disabled={pending} onClick={() => confirm(`Remove ${p.name}?`) && run(() => removePhase(p.id))}>
                      Remove
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {canEditSetup && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const r = await addPhase(newPhase);
                if (!r.error) setNewPhase("");
                return r;
              });
            }}
          >
            <input className="input" placeholder={`e.g. Phase ${phases.length + 1} – Support & Maintenance`} value={newPhase} onChange={(e) => setNewPhase(e.target.value)} />
            <button className="btn-primary shrink-0" disabled={pending || !newPhase.trim()}>
              + Add phase
            </button>
          </form>
        )}
      </section>

      {editing && <PhaseHoursDialog ts={ts} phase={editing} entries={entries} editable={canEditHours} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Field({
  client,
  field,
  label,
  type = "text",
  full,
  mono,
  editable,
  run,
}: {
  client: Client;
  field: "company_name" | "contact_name" | "contact_title" | "contact_email" | "project_name" | "project_code";
  label: string;
  type?: string;
  full?: boolean;
  mono?: boolean;
  editable: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="label">{label}</label>
      <input
        type={type}
        className={`input ${mono ? "font-mono" : ""}`}
        defaultValue={client[field]}
        disabled={!editable}
        onBlur={(e) => e.target.value.trim() !== client[field] && run(() => updateClient(client.id, field, e.target.value))}
      />
    </div>
  );
}

function PhaseHoursDialog({ ts, phase, entries, editable, onClose }: { ts: Timesheet; phase: Phase; entries: Entry[]; editable: boolean; onClose: () => void }) {
  const rows = entries.filter((e) => e.phase_id === phase.id);
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(rows.map((e) => [e.id, String(e.hours)])));
  const { pending, error, run } = useRun();

  // live totals with the edited values applied
  const live = useMemo(() => entries.map((e) => (values[e.id] !== undefined ? { ...e, hours: Number(values[e.id]) || 0 } : e)), [entries, values]);
  const days = dayTotals(live);
  const phaseTotal = sumHours(live.filter((e) => e.phase_id === phase.id));
  const overDays = [...new Set(rows.map((e) => e.entry_date))].filter((d) => (days.get(d) ?? 0) > MAX_DAY_HOURS);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-line p-5">
          <div>
            <h3 className="font-semibold">{phase.name}</h3>
            <p className="text-sm text-muted">
              {rows.length} entries · phase total <b className="text-ink">{fmtH(phaseTotal)} h</b>
            </p>
          </div>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          {rows.length === 0 ? (
            <p className="text-sm text-muted">No entries are tagged with this phase on this timesheet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Task</th>
                  <th className="pb-2 text-right">Hours</th>
                  <th className="pb-2 text-right">Day</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const day = days.get(e.entry_date) ?? 0;
                  return (
                    <tr key={e.id} className="border-t border-line align-top">
                      <td className="py-2 pr-2 whitespace-nowrap">
                        {fmtDay(e.entry_date)} <span className="text-muted">{dayName(e.entry_date)}</span>
                      </td>
                      <td className="py-2 pr-2">{e.category}</td>
                      <td className="py-2 pr-2 text-muted">{e.description}</td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          disabled={!editable}
                          className="input w-24 text-right"
                          value={values[e.id]}
                          onChange={(ev) => setValues({ ...values, [e.id]: ev.target.value })}
                        />
                      </td>
                      <td className={`py-2 pl-2 text-right font-semibold ${day > MAX_DAY_HOURS ? "text-danger" : ""}`}>{fmtH(day)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {overDays.length > 0 && (
            <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
              {overDays.map(fmtDay).join(", ")} would go over {MAX_DAY_HOURS} h. You can save, but submitting stays blocked until it&apos;s fixed.
            </p>
          )}
          {!editable && <p className="mt-4 text-sm text-muted">Hours can only be edited by the employee while the timesheet is a Draft or returned for changes.</p>}
          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        </div>
        {editable && rows.length > 0 && (
          <div className="flex justify-end gap-2 border-t border-line p-4">
            <button className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const changes = rows.map((e) => ({ id: e.id, hours: round2(Number(values[e.id])) })).filter((c, i) => c.hours !== rows[i].hours);
                  const r = await updatePhaseHours(ts.id, changes);
                  if (!r.error) onClose();
                  return r;
                })
              }
            >
              {pending ? "Saving…" : "Save hours"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
