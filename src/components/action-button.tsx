"use client";

import { useState, useTransition } from "react";

/** Runs a server action and shows its error (if any) under the button. */
export function ActionButton({
  action,
  children,
  className = "btn-primary",
  confirm,
  done,
}: {
  action: () => Promise<{ error?: string }>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  done?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setMsg(null);
          start(async () => {
            const r = await action();
            setMsg(r.error ? { error: r.error } : done ? { ok: done } : null);
          });
        }}
      >
        {pending ? "Working…" : children}
      </button>
      {msg?.error && <span className="max-w-xs text-right text-xs text-danger">{msg.error}</span>}
      {msg?.ok && <span className="max-w-xs text-right text-xs text-success">{msg.ok}</span>}
    </div>
  );
}
