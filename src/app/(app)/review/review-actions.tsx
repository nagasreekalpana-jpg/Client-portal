"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveTimesheet, sendBack } from "@/lib/actions";
import type { Timesheet } from "@/lib/domain";

export function ReviewActions({ ts, firstName }: { ts: Timesheet; firstName: string }) {
  const [mode, setMode] = useState<"idle" | "back">("idle");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      else {
        setMode("idle");
        // keep this sheet selected once it leaves the "submitted" state
        router.replace(`/review?ts=${ts.id}`, { scroll: false });
      }
    });

  if (ts.status === "approved")
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Approved — ready to share with the client.</p>
        <Link href={`/send-to-client?ts=${ts.id}`} className="btn-primary">
          Send to client →
        </Link>
      </div>
    );
  if (ts.status !== "submitted")
    return (
      <p className="text-sm text-muted">
        {ts.status === "shared" ? "Shared with the client — this period is closed." : `Waiting for ${firstName} to submit.`}
      </p>
    );

  return (
    <div>
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button className="btn-success" disabled={pending} onClick={() => run(() => approveTimesheet(ts.id))}>
            {pending ? "Approving…" : "Approve timesheet"}
          </button>
          <button className="btn-ghost" onClick={() => setMode("back")}>
            Send back with comment
          </button>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="comment">
            Comment for {firstName} (required)
          </label>
          <textarea
            id="comment"
            rows={3}
            className="input"
            placeholder="e.g. Split the 10.5 h on 30 Sep between demo and documentation."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <button className="btn-danger" disabled={pending || !comment.trim()} onClick={() => run(() => sendBack(ts.id, comment))}>
              {pending ? "Sending…" : "Send back"}
            </button>
            <button className="btn-ghost" onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
