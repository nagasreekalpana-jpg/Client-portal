"use client";

import { useState, useTransition } from "react";
import { getExportData, markShared } from "@/lib/actions";
import { downloadPdf } from "@/lib/export";

type Props = {
  tsId: string;
  code: string;
  version: number;
  to: string;
  contactName: string;
  clientName: string;
  projectName: string;
  employeeName: string;
  period: string;
  hours: string;
  managerName: string;
  company: string;
};

export function SendForm(p: Props) {
  const [to, setTo] = useState(p.to);
  const [subject, setSubject] = useState(`Timesheet ${p.code} · ${p.employeeName} · ${p.period}`);
  const [body, setBody] = useState(
    `Hi ${p.contactName.split(" ")[0] || "there"},\n\nPlease find attached the manager-approved timesheet for ${p.employeeName} on ${p.projectName || "the project"} for ${p.period} — ${p.hours} hours in total.\n\nReference: ${p.code} (v${p.version})\n\nRegards,\n${p.managerName}\n${p.company}`,
  );
  const [step, setStep] = useState<"compose" | "opened">("compose");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openEmail() {
    setError(null);
    start(async () => {
      try {
        await downloadPdf(await getExportData(p.tsId));
        window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + "\n\n(PDF attached)")}`;
        setStep("opened");
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Email to {p.clientName || "client"}</h2>
        <span className="font-mono text-xs text-muted">
          Attachment: {p.code}-v{p.version}.pdf
        </span>
      </div>
      <div className="grid gap-4">
        <div>
          <label className="label">To</label>
          <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Subject</label>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea className="input font-[inherit]" rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      </div>

      {step === "compose" ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={pending || !to} onClick={openEmail}>
            {pending ? "Preparing PDF…" : "Download PDF & open email"}
          </button>
          <span className="text-xs text-muted">Downloads the PDF and opens your mail app with this message. Attach the PDF, then send.</span>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-primary/30 bg-primary-soft p-4">
          <p className="text-sm">Once you&apos;ve sent the email with the PDF attached, record it here. This closes the period for {p.employeeName}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="btn-success"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await markShared(p.tsId, to);
                  if (r.error) setError(r.error);
                })
              }
            >
              {pending ? "Saving…" : "Mark as sent to client"}
            </button>
            <button className="btn-ghost" onClick={() => setStep("compose")}>
              Back
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
