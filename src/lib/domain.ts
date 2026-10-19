// Shared, pure helpers used by both server and client code.
// Dates are handled as 'YYYY-MM-DD' strings and computed in UTC so the
// server's timezone never shifts a day.

export type Role = "employee" | "manager";
export type Status = "draft" | "submitted" | "returned" | "approved" | "shared";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  designation: string;
  role: Role;
  manager_id: string | null;
  company: string;
  weekly_target: number;
};

export type Client = {
  id: string;
  owner_id: string;
  company_name: string;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  project_name: string;
  project_code: string;
};

export type Phase = {
  id: string;
  owner_id: string;
  name: string;
  sort_order: number;
  is_current: boolean;
};

export type Timesheet = {
  id: string;
  employee_id: string;
  client_id: string | null;
  period_start: string;
  period_end: string;
  status: Status;
  version: number;
  code: string;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  shared_at: string | null;
  shared_to: string | null;
  return_comment: string | null;
  returned_count: number;
  created_at: string;
};

export type Entry = {
  id: string;
  timesheet_id: string;
  entry_date: string;
  category: string;
  phase_id: string | null;
  phase_name: string;
  description: string;
  hours: number;
};

export type AuditEvent = {
  id: string;
  timesheet_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  status: Status | null;
  detail: string | null;
  created_at: string;
};

export const CATEGORIES = [
  { name: "Requirement Analysis & Planning", color: "#4f6bed" },
  { name: "Design & Prototyping", color: "#8b5cf6" },
  { name: "Development", color: "#14967f" },
  { name: "Testing/QA", color: "#d99a26" },
  { name: "Documentation", color: "#c45a8a" },
  { name: "Bug Fixing", color: "#dc5a3c" },
  { name: "Meetings", color: "#64748b" },
  { name: "Deployment & Support", color: "#0ea5e9" },
] as const;

export const MAX_DAY_HOURS = 12;

export function categoryColor(name: string) {
  return CATEGORIES.find((c) => c.name === name)?.color ?? "#94a3b8";
}

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  submitted: "Submitted",
  returned: "Returned",
  approved: "Manager Approved",
  shared: "Sent to Client",
};

export const EDITABLE: Status[] = ["draft", "returned"];

// ---------- numbers ----------

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** 4 -> "4.0", 3.8 -> "3.8", 7.75 -> "7.75" */
export function fmtH(n: number) {
  const r = round2(n);
  return Number.isInteger(r * 10) ? r.toFixed(1) : r.toFixed(2);
}

export function pct(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

// ---------- dates ----------

export function parseISO(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number) {
  const x = parseISO(d);
  x.setUTCDate(x.getUTCDate() + n);
  return toISO(x);
}

export function weekday(d: string) {
  return parseISO(d).getUTCDay(); // 0 Sun .. 6 Sat
}

export function isWeekday(d: string) {
  const w = weekday(d);
  return w !== 0 && w !== 6;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayName(d: string) {
  return DAYS[weekday(d)];
}

/** "28 Aug" */
export function fmtDay(d: string) {
  const x = parseISO(d);
  return `${String(x.getUTCDate()).padStart(2, "0")} ${MONTHS[x.getUTCMonth()]}`;
}

/** "28 Aug 2026" */
export function fmtDate(d: string) {
  const x = parseISO(d);
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}

/** "28 Aug – 30 Sep 2026" */
export function fmtRange(a: string, b: string) {
  const x = parseISO(a);
  const y = parseISO(b);
  const left =
    x.getUTCFullYear() === y.getUTCFullYear()
      ? `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`
      : fmtDate(a);
  return `${left} – ${fmtDate(b)}`;
}

/** "28 Aug – 4 Sep" (no year) */
export function fmtShortRange(a: string, b: string) {
  const x = parseISO(a);
  const y = parseISO(b);
  if (x.getUTCMonth() === y.getUTCMonth())
    return `${x.getUTCDate()} – ${y.getUTCDate()} ${MONTHS[y.getUTCMonth()]}`;
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} – ${y.getUTCDate()} ${MONTHS[y.getUTCMonth()]}`;
}

/** Timestamps are shown in IST. */
export function fmtStamp(ts: string | null) {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}

/** Calendar date (YYYY-MM-DD) of a timestamp, in IST. */
export function istDate(ts: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ts));
}

export function todayISO() {
  // "today" in IST
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/** Billing period: 28th of one month to the 27th of the next. */
export function periodFor(date: string) {
  const x = parseISO(date);
  let y = x.getUTCFullYear();
  let m = x.getUTCMonth();
  if (x.getUTCDate() < 28) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  const start = toISO(new Date(Date.UTC(y, m, 28)));
  const end = toISO(new Date(Date.UTC(y, m + 1, 27)));
  return { start, end };
}

export function weekdaysBetween(a: string, b: string) {
  const out: string[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) if (isWeekday(d)) out.push(d);
  return out;
}

export type Week = { index: number; label: string; start: string; end: string };

/** W1 runs from the period start to the first Sunday; then Mon–Sun weeks. */
export function weeksOf(start: string, end: string): Week[] {
  const weeks: Week[] = [];
  let s = start;
  while (s <= end) {
    const toSunday = (7 - weekday(s)) % 7;
    let e = addDays(s, toSunday);
    if (e > end) e = end;
    // skip weeks that contain only weekend days
    if (weekdaysBetween(s, e).length > 0) {
      const i = weeks.length + 1;
      weeks.push({ index: i, label: `W${i}`, start: s, end: e });
    }
    s = addDays(e, 1);
  }
  return weeks;
}

export function weekOf(weeks: Week[], d: string) {
  return weeks.find((w) => d >= w.start && d <= w.end);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function timesheetCode(projectCode: string, periodEnd: string, fullName: string) {
  const code = (projectCode || "GEN").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const x = parseISO(periodEnd);
  const yymm = `${String(x.getUTCFullYear()).slice(2)}${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
  return `TS-${code}-${yymm}-${initials(fullName)}`;
}

// ---------- calculations ----------

export function dayTotals(entries: Entry[]) {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.entry_date, round2((m.get(e.entry_date) ?? 0) + Number(e.hours)));
  return m;
}

export function sumHours(entries: Entry[]) {
  return round2(entries.reduce((a, e) => a + Number(e.hours), 0));
}

export type Summary = ReturnType<typeof summarize>;

export function summarize(ts: Pick<Timesheet, "period_start" | "period_end">, entries: Entry[], weeklyTarget = 40) {
  const weeks = weeksOf(ts.period_start, ts.period_end);
  const days = dayTotals(entries);
  const total = sumHours(entries);
  const weekdays = weekdaysBetween(ts.period_start, ts.period_end);
  const loggedDays = weekdays.filter((d) => (days.get(d) ?? 0) > 0);
  const missingDays = weekdays.filter((d) => !((days.get(d) ?? 0) > 0));
  const overDays = [...days.entries()].filter(([, h]) => h > MAX_DAY_HOURS).map(([d]) => d);
  const maxDay = Math.max(0, ...days.values());

  const weekRows = weeks.map((w) => {
    const es = entries.filter((e) => e.entry_date >= w.start && e.entry_date <= w.end);
    const hours = sumHours(es);
    const workdays = weekdaysBetween(w.start, w.end).length;
    const loggedInWeek = new Set(es.map((e) => e.entry_date)).size;
    return { ...w, hours, workdays, days: loggedInWeek, target: round2((weeklyTarget / 5) * workdays) };
  });

  const names = [...CATEGORIES.map((c) => c.name as string), ...entries.map((e) => e.category)];
  const categories = [...new Set(names)]
    .map((name) => ({
      name,
      color: categoryColor(name),
      hours: sumHours(entries.filter((e) => e.category === name)),
    }))
    .filter((c) => c.hours > 0);
  const top = [...categories].sort((a, b) => b.hours - a.hours)[0];

  const incomplete = entries.filter((e) => !e.category || !e.description.trim());

  const checks = [
    {
      ok: missingDays.length === 0 && weekdays.length > 0,
      label: missingDays.length === 0 ? `All ${weekdays.length} weekdays have hours` : `${missingDays.length} weekday(s) missing hours`,
      hint:
        missingDays.length === 0
          ? `${fmtShortRange(ts.period_start, ts.period_end)}, weekends excluded`
          : `Missing: ${missingDays.slice(0, 4).map(fmtDay).join(", ")}${missingDays.length > 4 ? "…" : ""}`,
    },
    {
      ok: overDays.length === 0,
      label: overDays.length === 0 ? `No day exceeds ${MAX_DAY_HOURS} hours` : `${overDays.length} day(s) over ${MAX_DAY_HOURS} hours`,
      hint: overDays.length === 0 ? `Highest day: ${fmtH(maxDay)} h` : `Fix: ${overDays.map(fmtDay).join(", ")}`,
    },
    {
      ok: incomplete.length === 0 && entries.length > 0,
      label: entries.length === 0 ? "No entries yet" : "Every entry has a category and description",
      hint: `${entries.length - incomplete.length} entries complete`,
    },
    { ok: true, label: "Totals calculated automatically", hint: `${fmtH(total)} h = sum of daily entries` },
  ];

  return {
    weeks: weekRows,
    days,
    total,
    weekdays,
    loggedDays: loggedDays.length,
    missingDays,
    overDays,
    maxDay,
    avgPerDay: loggedDays.length ? round2(total / loggedDays.length) : 0,
    avgPerWeek: weekRows.length ? round2(total / weekRows.length) : 0,
    peakWeek: [...weekRows].sort((a, b) => b.hours - a.hours)[0],
    categories,
    topCategory: top,
    checks,
    canSubmit: checks.every((c) => c.ok),
  };
}
