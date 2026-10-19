"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthHero } from "@/components/auth-hero";
import { signIn } from "@/lib/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <AuthHero />
      <section className="flex items-center justify-center bg-surface p-6 sm:p-12">
        <form action={action} className="w-full max-w-md">
          <div className="font-mono text-xs uppercase tracking-widest text-muted">Sign in</div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-muted">Employees and managers sign in with their work email.</p>

          <label className="label mt-8" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input py-2.5" placeholder="you@hrudai.com" />

          <label className="label mt-4" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input py-2.5" />

          {state?.error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

          <button disabled={pending} className="btn-primary mt-6 w-full py-3">
            {pending ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-6 text-center text-sm text-muted">
            New here?{" "}
            <Link href="/signup" className="font-semibold text-primary">
              Create an account
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
