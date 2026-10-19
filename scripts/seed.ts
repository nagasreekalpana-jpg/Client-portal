// Seeds demo users and timesheets. Re-running wipes and recreates the demo users.
// Usage: npm run seed
import { createClient } from "@supabase/supabase-js";
import { addDays, periodFor, timesheetCode, todayISO, weekdaysBetween } from "../src/lib/domain";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD;
if (!url || !key || !password) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_PASSWORD in .env.local");

const db = createClient(url, key, { auth: { persistSession: false } });
const DOMAIN = "timesheet.test";

const PEOPLE = [
  { key: "lakshmi", full_name: "Muripilli Lakshmi", designation: "Reporting Manager", role: "manager" },
  { key: "harish", full_name: "Harish Varri", designation: "AI Developer", role: "employee" },
  { key: "sneha", full_name: "Sneha Kulkarni", designation: "QA Engineer", role: "employee" },
  { key: "arjun", full_name: "Arjun Patel", designation: "Data Engineer", role: "employee" },
] as const;

const TASKS: [string, string][] = [
  ["Requirement Analysis & Planning", "Stakeholder workshop; reviewed scope & SOW"],
  ["Requirement Analysis & Planning", "Mapped audit & CAPA workflows; drafted backlog"],
  ["Design & Prototyping", "Data model for audits, findings and CAPA entities"],
  ["Design & Prototyping", "Wireframes for audit dashboard and findings list"],
  ["Development", "Document ingestion service (FastAPI) for SOP uploads"],
  ["Development", "LLM-based SOP clause extraction pipeline"],
  ["Development", "Findings API and role-based access"],
  ["Development", "Audit dashboard UI — filters and drill-down"],
  ["Testing/QA", "Regression suite for document control module"],
  ["Testing/QA", "UAT support with JAGS QA team"],
  ["Documentation", "API reference and admin guide"],
  ["Documentation", "Release notes and handover checklist"],
  ["Bug Fixing", "Fixed CAPA due-date calculation edge cases"],
  ["Meetings", "Sprint review and planning"],
];

// small deterministic PRNG so every seed produces the same data
let s = 42;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const quarter = (n: number) => Math.round(n * 4) / 4;

const stamp = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:30`).toISOString();

async function main() {
  // wipe previous demo users (profiles and their data cascade)
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`))) await db.auth.admin.deleteUser(u.id);

  const ids: Record<string, string> = {};
  for (const p of PEOPLE) {
    const email = `${p.key}@${DOMAIN}`;
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    ids[p.key] = data.user.id;
  }
  for (const p of PEOPLE) {
    const { error } = await db.from("profiles").insert({
      id: ids[p.key],
      email: `${p.key}@${DOMAIN}`,
      full_name: p.full_name,
      designation: p.designation,
      role: p.role,
      manager_id: p.role === "employee" ? ids.lakshmi : null,
    });
    if (error) throw error;
  }

  const today = todayISO();
  const current = periodFor(today);
  const prev = (n: number) => {
    let start = current.start;
    for (let i = 0; i < n; i++) start = periodFor(addDays(start, -1)).start;
    return periodFor(start);
  };

  for (const p of PEOPLE.filter((x) => x.role === "employee")) {
    const owner = ids[p.key];
    const { data: client } = await db
      .from("clients")
      .insert({
        owner_id: owner,
        company_name: "JAGS Assurance Company",
        contact_name: "Rahul Menon",
        contact_title: "Program Manager",
        contact_email: "rahul.menon@example.com",
        project_name: "JAGS QMP Project",
        project_code: "JAGS-QMP",
      })
      .select("*")
      .single();
    const { data: phases } = await db
      .from("phases")
      .insert([
        { owner_id: owner, name: "Phase 1 – Discovery & Design", sort_order: 1, is_current: false },
        { owner_id: owner, name: "Phase 2 – Build", sort_order: 2, is_current: false },
        { owner_id: owner, name: "Phase 3 – UAT & Handover", sort_order: 3, is_current: true },
      ])
      .select("*");

    // [period, status]: oldest → newest
    const plan: [{ start: string; end: string }, string][] =
      p.key === "harish"
        ? [[prev(3), "shared"], [prev(2), "shared"], [prev(1), "submitted"], [current, "draft"]]
        : p.key === "sneha"
          ? [[prev(2), "shared"], [prev(1), "approved"]]
          : [[prev(2), "shared"], [prev(1), "shared"]];

    for (const [i, [period, status]] of plan.entries()) {
      const after = addDays(period.end, 1);
      const returned = p.key === "harish" && i === 0;
      const { data: ts, error } = await db
        .from("timesheets")
        .insert({
          employee_id: owner,
          client_id: client!.id,
          period_start: period.start,
          period_end: period.end,
          status,
          version: returned ? 2 : 1,
          returned_count: returned ? 1 : 0,
          code: timesheetCode("JAGS-QMP", period.end, p.full_name),
          submitted_at: status === "draft" ? null : stamp(after, "10:02"),
          approved_at: ["approved", "shared"].includes(status) ? stamp(after, "15:30") : null,
          approved_by: ["approved", "shared"].includes(status) ? ids.lakshmi : null,
          shared_at: status === "shared" ? stamp(after, "16:05") : null,
          shared_to: status === "shared" ? "rahul.menon@example.com" : null,
        })
        .select("*")
        .single();
      if (error) throw error;

      // entries: every weekday up to today, 1–2 entries a day, 7–10.5 h
      const last = period.end < today ? period.end : today;
      const days = weekdaysBetween(period.start, last);
      const rows = days.flatMap((d, di) => {
        const phase = phases![Math.min(2, Math.floor((di / Math.max(1, days.length)) * 3))];
        const total = quarter(7 + rnd() * 3.5);
        const split = rnd() < 0.45 ? quarter(total * (0.35 + rnd() * 0.3)) : total;
        const parts = split === total ? [total] : [split, total - split];
        return parts.map((h) => {
          const [category, description] = pick(TASKS);
          return { timesheet_id: ts.id, entry_date: d, category, phase_id: phase.id, phase_name: phase.name, description, hours: h };
        });
      });
      if (rows.length) await db.from("time_entries").insert(rows);

      const sum = rows.reduce((a, r) => a + r.hours, 0).toFixed(1);
      const events = [
        { actor: "System", role: "System", action: "Timesheet period opened", status: "draft", at: stamp(period.start, "09:00") },
        { actor: p.full_name, role: "Employee", action: `Entries saved (${rows.length} rows)`, status: "draft", at: stamp(last, "18:42") },
      ];
      if (status !== "draft")
        events.push({ actor: p.full_name, role: "Employee", action: "Submitted for manager approval", status: "submitted", at: stamp(after, "10:02") });
      if (["approved", "shared"].includes(status))
        events.push({ actor: "Muripilli Lakshmi", role: "Manager", action: "Approved by manager", status: "approved", at: stamp(after, "15:30") });
      if (status === "shared")
        events.push({ actor: "Muripilli Lakshmi", role: "Manager", action: "Shared with client", status: "shared", at: stamp(after, "16:05") });
      await db.from("audit_events").insert(
        events.map((e) => ({
          timesheet_id: ts.id,
          actor_id: e.role === "Employee" ? owner : e.role === "Manager" ? ids.lakshmi : null,
          actor_name: e.actor,
          actor_role: e.role,
          action: e.action,
          status: e.status,
          detail: e.action.startsWith("Submitted") ? `${sum} h` : null,
          created_at: e.at,
        })),
      );
    }
  }

  console.log("Seeded demo accounts (password = SEED_PASSWORD in .env.local):");
  for (const p of PEOPLE) console.log(`  ${p.role.padEnd(8)} ${p.key}@${DOMAIN}  (${p.full_name})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
