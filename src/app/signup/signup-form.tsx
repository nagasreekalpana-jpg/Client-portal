"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signUp } from "@/lib/actions";

type Manager = { id: string; full_name: string; designation: string };

export function SignupForm({ managers }: { managers: Manager[] }) {
  const [state, action, pending] = useActionState(signUp, undefined);
  const [role, setRole] = useState<"employee" | "manager">("employee");

  return (
    <form action={action} className="w-full max-w-md">
      <div className="font-mono text-xs uppercase tracking-widest text-muted">Create account</div>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">Choose a role</h2>

      <div className="mt-6 space-y-3">
        {(
          [
            ["employee", "Employee", "Log daily hours and submit for approval"],
            ["manager", "Manager", "Review, approve and share with clients"],
          ] as const
        ).map(([value, title, hint]) => (
          <label
            key={value}
            className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
              role === value ? "border-primary bg-primary-soft" : "border-line hover:bg-surface-2"
            }`}
          >
            <div>
              <div className="font-semibold">{title}</div>
              <div className="text-xs text-muted">{hint}</div>
            </div>
            <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="size-4 accent-[var(--primary)]" />
          </label>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="full_name">Full name</label>
          <input id="full_name" name="full_name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="designation">Designation</label>
          <input id="designation" name="designation" className="input" placeholder={role === "manager" ? "Reporting Manager" : "AI Developer"} />
        </div>
      </div>

      {role === "employee" && (
        <div className="mt-4">
          <label className="label" htmlFor="manager_id">Reporting manager</label>
          <select id="manager_id" name="manager_id" required className="input" defaultValue="">
            <option value="" disabled>
              {managers.length ? "Select your manager" : "No managers yet — a manager must sign up first"}
            </option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
                {m.designation ? ` · ${m.designation}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="label mt-4" htmlFor="email">Work email</label>
      <input id="email" name="email" type="email" autoComplete="email" required className="input" />

      <label className="label mt-4" htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />

      {state?.error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      <button disabled={pending} className="btn-primary mt-6 w-full py-3">
        {pending ? "Creating account…" : `Continue as ${role === "manager" ? "Manager" : "Employee"}`}
      </button>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary">
          Sign in
        </Link>
      </p>
    </form>
  );
}
