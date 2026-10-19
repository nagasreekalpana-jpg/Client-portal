import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { authClient, db } from "./supabase";
import {
  periodFor,
  timesheetCode,
  todayISO,
  type AuditEvent,
  type Client,
  type Entry,
  type Phase,
  type Profile,
  type Timesheet,
} from "./domain";

export const getMe = cache(async (): Promise<Profile> => {
  const supabase = await authClient();
  // verifies the session JWT locally when the project uses asymmetric signing keys
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");
  const { data } = await db().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!data) {
    // auth user without a profile (e.g. created outside the app)
    await supabase.auth.signOut();
    redirect("/login?error=no-profile");
  }
  return normProfile(data);
});

function normProfile(p: Record<string, unknown>): Profile {
  return { ...(p as Profile), weekly_target: Number(p.weekly_target) };
}

function normEntry(e: Record<string, unknown>): Entry {
  return { ...(e as Entry), hours: Number(e.hours) };
}

export async function getProfile(id: string) {
  const { data } = await db().from("profiles").select("*").eq("id", id).maybeSingle();
  return data ? normProfile(data) : null;
}

export async function getManagers() {
  const { data } = await db().from("profiles").select("id, full_name, designation").eq("role", "manager").order("full_name");
  return (data ?? []) as Pick<Profile, "id" | "full_name" | "designation">[];
}

export async function getClients(ownerId: string) {
  const { data } = await db().from("clients").select("*").eq("owner_id", ownerId).order("created_at");
  return (data ?? []) as Client[];
}

export async function getPhases(ownerId: string) {
  const { data } = await db().from("phases").select("*").eq("owner_id", ownerId).order("sort_order");
  return (data ?? []) as Phase[];
}

export async function getTimesheets(employeeId: string) {
  const { data } = await db()
    .from("timesheets")
    .select("*")
    .eq("employee_id", employeeId)
    .order("period_start", { ascending: false });
  return (data ?? []) as Timesheet[];
}

export async function getEntries(timesheetId: string) {
  const { data } = await db()
    .from("time_entries")
    .select("*")
    .eq("timesheet_id", timesheetId)
    .order("entry_date")
    .order("created_at");
  return (data ?? []).map(normEntry);
}

export async function getAudit(timesheetId: string) {
  const { data } = await db()
    .from("audit_events")
    .select("*")
    .eq("timesheet_id", timesheetId)
    .order("created_at", { ascending: false });
  return (data ?? []) as AuditEvent[];
}

/** Make sure a new employee has a client and a phase to log against. */
export async function ensureEmployeeSetup(me: Profile) {
  const [existing, phases] = await Promise.all([getClients(me.id), getPhases(me.id)]);
  let clients = existing;
  if (clients.length === 0) {
    const { data } = await db()
      .from("clients")
      .insert({ owner_id: me.id, company_name: "My first client", project_name: "New project", project_code: "PRJ" })
      .select("*")
      .single();
    clients = [data as Client];
  }
  if (phases.length === 0) {
    await db().from("phases").insert({ owner_id: me.id, name: "Phase 1", sort_order: 1, is_current: true });
  }
  return clients;
}

/**
 * The employee's working timesheet: one returned for changes, else the newest
 * one not yet shared with the client, else a fresh one for today's period.
 */
export const getCurrentTimesheet = cache(async (me: Profile): Promise<Timesheet> => {
  const [clients, sheets] = await Promise.all([ensureEmployeeSetup(me), getTimesheets(me.id)]);
  // a sheet sent back for changes needs action first, even if a newer one exists
  const open = sheets.find((s) => s.status === "returned") ?? sheets.find((s) => s.status !== "shared");
  if (open) return open;

  const today = periodFor(todayISO());
  const latest = sheets[0];
  if (latest && latest.period_start >= today.start) return latest;

  const client = clients[0];
  const { data, error } = await db()
    .from("timesheets")
    .insert({
      employee_id: me.id,
      client_id: client.id,
      period_start: today.start,
      period_end: today.end,
      code: timesheetCode(client.project_code, today.end, me.full_name),
    })
    .select("*")
    .single();
  if (error) throw error;
  await logEvent(data.id, null, "System", "System", "Timesheet period opened", "draft");
  return data as Timesheet;
});

export async function getTimesheet(id: string) {
  const { data } = await db().from("timesheets").select("*").eq("id", id).maybeSingle();
  return (data as Timesheet) ?? null;
}

/** Employees can see their own sheets; managers can see their reports' sheets. */
export async function canView(me: Profile, ts: Timesheet) {
  if (ts.employee_id === me.id) return true;
  if (me.role !== "manager") return false;
  const emp = await getProfile(ts.employee_id);
  return emp?.manager_id === me.id;
}

export const getBundle = cache(async (ts: Timesheet) => {
  const [entries, audit, employee, client, phases] = await Promise.all([
    getEntries(ts.id),
    getAudit(ts.id),
    getProfile(ts.employee_id),
    ts.client_id
      ? db().from("clients").select("*").eq("id", ts.client_id).maybeSingle().then((r) => r.data as Client | null)
      : Promise.resolve(null),
    getPhases(ts.employee_id),
  ]);
  const manager = employee?.manager_id ? await getProfile(employee.manager_id) : null;
  return { ts, entries, audit, employee: employee!, client, phases, manager };
});

export type Bundle = Awaited<ReturnType<typeof getBundle>>;

export async function getTeam(managerId: string) {
  const { data } = await db().from("profiles").select("*").eq("manager_id", managerId).order("full_name");
  return (data ?? []).map(normProfile);
}

/** All timesheets of a manager's reports, newest period first, with totals. */
export const getTeamSheets = cache(async (managerId: string) => {
  const team = await getTeam(managerId);
  if (team.length === 0) return [];
  const { data } = await db()
    .from("timesheets")
    .select("*, clients(project_name, project_code, company_name), time_entries(hours)")
    .in(
      "employee_id",
      team.map((t) => t.id),
    )
    .order("period_start", { ascending: false });
  return (data ?? []).map((row) => {
    const { time_entries, clients, ...ts } = row as Timesheet & {
      time_entries: { hours: number }[];
      clients: Pick<Client, "project_name" | "project_code" | "company_name"> | null;
    };
    return {
      ts: ts as Timesheet,
      employee: team.find((t) => t.id === ts.employee_id)!,
      client: clients,
      hours: Math.round(time_entries.reduce((a, e) => a + Number(e.hours), 0) * 100) / 100,
    };
  });
});

export type TeamSheet = Awaited<ReturnType<typeof getTeamSheets>>[number];

/**
 * The timesheet a page should show: for employees their current sheet (or the
 * ?ts= one if it is theirs); for managers the ?ts= sheet if it belongs to a
 * report, else the first one awaiting review.
 */
export async function resolveSheet(me: Profile, tsParam?: string) {
  if (tsParam) {
    const ts = await getTimesheet(tsParam);
    if (ts && (await canView(me, ts))) return ts;
  }
  if (me.role === "employee") return getCurrentTimesheet(me);
  const sheets = await getTeamSheets(me.id);
  return (sheets.find((s) => s.ts.status === "submitted") ?? sheets[0])?.ts ?? null;
}

export async function logEvent(
  timesheetId: string,
  actor: Profile | null,
  actorName: string,
  actorRole: string,
  action: string,
  status: string | null,
  detail?: string,
) {
  await db()
    .from("audit_events")
    .insert({
      timesheet_id: timesheetId,
      actor_id: actor?.id ?? null,
      actor_name: actorName,
      actor_role: actorRole,
      action,
      status,
      detail: detail ?? null,
    });
}
