"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Role } from "@/lib/domain";

const NAV: Record<Role, { href: string; label: string }[]> = {
  employee: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/time-entry", label: "Time Entry" },
    { href: "/weekly-summary", label: "Weekly Summary" },
    { href: "/preview", label: "Timesheet Preview" },
    { href: "/history", label: "History" },
    { href: "/project-client", label: "Project & Client" },
  ],
  manager: [
    { href: "/review", label: "Review Queue" },
    { href: "/send-to-client", label: "Send to Client" },
    { href: "/weekly-summary", label: "Weekly Summary" },
    { href: "/preview", label: "Timesheet Preview" },
    { href: "/history", label: "History" },
    { href: "/project-client", label: "Project & Client" },
  ],
};

function NavLinks({ role, badge, onNavigate }: { role: Role; badge?: number; onNavigate?: () => void }) {
  const path = usePathname();
  const params = useSearchParams();
  const ts = params.get("ts");
  // managers keep the selected timesheet while moving between pages
  const keep = role === "manager" && ts ? `?ts=${ts}` : "";
  return (
    <nav className="space-y-1">
      {NAV[role].map((n) => {
        const active = path === n.href;
        return (
          <Link
            key={n.href}
            href={n.href + (n.href === "/history" ? "" : keep)}
            onClick={onNavigate}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-[15px] transition ${
              active ? "bg-primary-soft font-semibold text-primary" : "text-ink hover:bg-surface-2"
            }`}
          >
            {n.label}
            {n.href === "/review" && !!badge && (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">{badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  role,
  badge,
  periodCard,
  user,
}: {
  role: Role;
  badge?: number;
  periodCard: React.ReactNode;
  user: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const body = (
    <>
      <div className="flex items-center gap-3 px-1">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">TS</span>
        <div>
          <div className="font-semibold leading-tight">TimeSheet Pro</div>
          <div className="text-xs text-muted">Hrudai</div>
        </div>
      </div>
      <div className="my-5">{periodCard}</div>
      <Suspense>
        <NavLinks role={role} badge={badge} onNavigate={() => setOpen(false)} />
      </Suspense>
      <div className="mt-auto border-t border-line pt-4">{user}</div>
    </>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">{body}</aside>
      <button className="btn-ghost btn-sm fixed right-4 bottom-4 z-40 shadow-lg lg:hidden" onClick={() => setOpen(true)}>
        ☰ Menu
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface p-4">{body}</aside>
        </div>
      )}
    </>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  return (
    <button
      className="btn-ghost btn-sm"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("theme", next ? "dark" : "light");
        } catch {}
      }}
    >
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
