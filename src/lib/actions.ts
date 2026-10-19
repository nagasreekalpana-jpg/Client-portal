"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authClient, db } from "./supabase";
import {
  canView,
  getBundle,
  getClients,
  getEntries,
  getMe,
  getPhases,
  getTimesheet,
  getTimesheets,
  logEvent,
} from "./data";
import {
  CATEGORIES,
  EDITABLE,
  addDays,
  fmtDay,
  fmtH,
  isWeekday,
  round2,
  summarize,
  timesheetCode,
  type Profile,
  type Timesheet,
} from "./domain";

type Result = { error?: string; ok?: boolean };

function done(): Result {
  revalidatePath("/", "layout");
  return { ok: true };
}

const ROLE_LABEL = { employee: "Employee", manager: "Manager" } as const;

// ---------- auth ----------

export async function signIn(_: Result | undefined, form: FormData): Promise<Result> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const supabase = await authClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email or password is incorrect." };
  const { data: profile } = await db().from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  redirect(profile?.role === "manager" ? "/review" : "/dashboard");
}

export async function signUp(_: Result | undefined, form: FormData): Promise<Result> {
  const fullName = String(form.get("full_name") ?? "").trim();
  const designation = String(form.get("designation") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const role = form.get("role") === "manager" ? "manager" : "employee";
  const managerId = String(form.get("manager_id") ?? "") || null;

  if (!fullName || !email) return { error: "Name and email are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (role === "employee" && !managerId) return { error: "Pick your reporting manager." };

  const admin = db();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return { error: error?.message ?? "Could not create the account." };

  const { error: pErr } = await admin.from("profiles").insert({
    id: data.user.id,
    email,
    full_name: fullName,
    designation,
    role,
    manager_id: role === "employee" ? managerId : null,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: pErr.message };
  }

  const supabase = await authClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect(role === "manager" ? "/review" : "/dashboard");
}

export async function signOut() {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- guards ----------

async function ownSheet(timesheetId: string) {
  const me = await getMe();
  const ts = await getTimesheet(timesheetId);
  if (!ts || ts.employee_id !== me.id) throw new Error("Not your timesheet.");
  return { me, ts };
}

async function editableSheet(timesheetId: string) {
  const r = await ownSheet(timesheetId);
  if (!EDITABLE.includes(r.ts.status)) throw new Error("This timesheet is locked.");
  return r;
}

async function managedSheet(timesheetId: string) {
  const me = await getMe();
  const ts = await getTimesheet(timesheetId);
  if (me.role !== "manager" || !ts || ts.employee_id === me.id || !(await canView(me, ts)))
    throw new Error("You are not the reporting manager for this timesheet.");
  return { me, ts };
}

function wrap(fn: () => Promise<Result | void>): Promise<Result> {
  return fn()
    .then((r) => r ?? done())
    .catch((e: Error) => ({ error: e.message }));
}

function actor(me: Profile) {
  return [me, me.full_name, ROLE_LABEL[me.role]] as const;
}

// ---------- entries ----------

type EntryInput = {
  entry_date: string;
  category: string;
  phase_id: string | null;
  description: string;
  hours: number;
};

async function validateEntry(ts: Timesheet, input: EntryInput) {
  const hours = round2(Number(input.hours));
  if (!input.entry_date) throw new Error("Pick a date.");
  if (input.entry_date < ts.period_start || input.entry_date > ts.period_end)
    throw new Error("Date is outside this timesheet period.");
  if (!isWeekday(input.entry_date)) throw new Error("Weekdays only — weekends can't be logged.");
  if (!CATEGORIES.some((c) => c.name === input.category)) throw new Error("Pick a category.");
  if (!input.description.trim()) throw new Error("Add a task description.");
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("Hours must be more than 0.");
  if (hours > 24) throw new Error("Hours can't exceed 24 in a single entry.");
  const phases = await getPhases(ts.employee_id);
  const phase = phases.find((p) => p.id === input.phase_id);
  return { hours, phase_id: phase?.id ?? null, phase_name: phase?.name ?? "" };
}

export async function addEntry(timesheetId: string, input: EntryInput) {
  return wrap(async () => {
    const { me, ts } = await editableSheet(timesheetId);
    const v = await validateEntry(ts, input);
    const { error } = await db()
      .from("time_entries")
      .insert({
        timesheet_id: ts.id,
        entry_date: input.entry_date,
        category: input.category,
        description: input.description.trim(),
        ...v,
      });
    if (error) throw error;
    await logEvent(ts.id, ...actor(me), "Entry added", ts.status, `${fmtDay(input.entry_date)} · ${fmtH(v.hours)} h · ${input.category}`);
  });
}

export async function updateEntry(entryId: string, input: EntryInput) {
  return wrap(async () => {
    const { data: old } = await db().from("time_entries").select("*").eq("id", entryId).single();
    if (!old) throw new Error("Entry not found.");
    const { me, ts } = await editableSheet(old.timesheet_id);
    const v = await validateEntry(ts, input);
    const { error } = await db()
      .from("time_entries")
      .update({
        entry_date: input.entry_date,
        category: input.category,
        description: input.description.trim(),
        updated_at: new Date().toISOString(),
        ...v,
      })
      .eq("id", entryId);
    if (error) throw error;
    const changed = Number(old.hours) !== v.hours;
    await logEvent(
      ts.id,
      ...actor(me),
      changed ? "Hours changed" : "Entry edited",
      ts.status,
      changed
        ? `${fmtDay(input.entry_date)} · ${fmtH(Number(old.hours))} h → ${fmtH(v.hours)} h`
        : `${fmtDay(input.entry_date)} · ${input.category}`,
    );
  });
}

export async function deleteEntry(entryId: string) {
  return wrap(async () => {
    const { data: old } = await db().from("time_entries").select("*").eq("id", entryId).single();
    if (!old) throw new Error("Entry not found.");
    const { me, ts } = await editableSheet(old.timesheet_id);
    await db().from("time_entries").delete().eq("id", entryId);
    await logEvent(ts.id, ...actor(me), "Entry removed", ts.status, `${fmtDay(old.entry_date)} · ${fmtH(Number(old.hours))} h`);
  });
}

/** Bulk hour edits from the "Edit hours" phase dialog. */
export async function updatePhaseHours(timesheetId: string, changes: { id: string; hours: number }[]) {
  return wrap(async () => {
    const { me, ts } = await editableSheet(timesheetId);
    const entries = await getEntries(ts.id);
    for (const c of changes) {
      const e = entries.find((x) => x.id === c.id);
      if (!e) continue;
      const hours = round2(Number(c.hours));
      if (!Number.isFinite(hours) || hours <= 0) throw new Error(`Hours on ${fmtDay(e.entry_date)} must be more than 0.`);
      if (hours === e.hours) continue;
      await db().from("time_entries").update({ hours, updated_at: new Date().toISOString() }).eq("id", e.id);
      await logEvent(ts.id, ...actor(me), "Hours changed", ts.status, `${fmtDay(e.entry_date)} · ${e.phase_name} · ${fmtH(e.hours)} h → ${fmtH(hours)} h`);
    }
  });
}

// ---------- workflow ----------

export async function submitTimesheet(timesheetId: string) {
  return wrap(async () => {
    const { me, ts } = await editableSheet(timesheetId);
    if (!me.manager_id) throw new Error("You don't have a reporting manager set.");
    const entries = await getEntries(ts.id);
    const s = summarize(ts, entries, me.weekly_target);
    const failed = s.checks.find((c) => !c.ok);
    if (failed) throw new Error(`${failed.label}. ${failed.hint}`);
    const version = ts.status === "returned" ? ts.version + 1 : ts.version;
    await db()
      .from("timesheets")
      .update({ status: "submitted", submitted_at: new Date().toISOString(), version })
      .eq("id", ts.id);
    await logEvent(ts.id, ...actor(me), "Submitted for manager approval", "submitted", `${fmtH(s.total)} h · v${version}`);
  });
}

export async function approveTimesheet(timesheetId: string) {
  return wrap(async () => {
    const { me, ts } = await managedSheet(timesheetId);
    if (ts.status !== "submitted") throw new Error("Only submitted timesheets can be approved.");
    await db()
      .from("timesheets")
      .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: me.id, return_comment: null })
      .eq("id", ts.id);
    await logEvent(ts.id, ...actor(me), "Approved by manager", "approved");
  });
}

export async function sendBack(timesheetId: string, comment: string) {
  return wrap(async () => {
    const { me, ts } = await managedSheet(timesheetId);
    if (ts.status !== "submitted") throw new Error("Only submitted timesheets can be sent back.");
    if (!comment.trim()) throw new Error("A comment is required.");
    await db()
      .from("timesheets")
      .update({ status: "returned", return_comment: comment.trim(), returned_count: ts.returned_count + 1 })
      .eq("id", ts.id);
    await logEvent(ts.id, ...actor(me), "Sent back for changes", "returned", comment.trim());
  });
}

export async function markShared(timesheetId: string, to: string) {
  return wrap(async () => {
    const { me, ts } = await managedSheet(timesheetId);
    if (ts.status !== "approved") throw new Error("Only manager-approved timesheets can be shared.");
    if (!/^\S+@\S+\.\S+$/.test(to.trim())) throw new Error("Enter a valid client email.");
    await db()
      .from("timesheets")
      .update({ status: "shared", shared_at: new Date().toISOString(), shared_to: to.trim() })
      .eq("id", ts.id);
    await logEvent(ts.id, ...actor(me), "Shared with client", "shared", to.trim());
  });
}

export async function startNextPeriod() {
  return wrap(async () => {
    const me = await getMe();
    const sheets = await getTimesheets(me.id);
    const latest = sheets[0];
    if (!latest) throw new Error("No previous timesheet.");
    if (latest.status !== "shared") throw new Error("Finish the current period first.");
    const start = addDays(latest.period_end, 1);
    const [y, m] = start.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 27)).toISOString().slice(0, 10);
    const clients = await getClients(me.id);
    const client = clients.find((c) => c.id === latest.client_id) ?? clients[0];
    const { data, error } = await db()
      .from("timesheets")
      .insert({
        employee_id: me.id,
        client_id: client?.id ?? null,
        period_start: start,
        period_end: end,
        code: timesheetCode(client?.project_code ?? "", end, me.full_name),
      })
      .select("id")
      .single();
    if (error) throw error;
    await logEvent(data.id, null, "System", "System", "Timesheet period opened", "draft");
  });
}

/** Everything the PDF/Excel exporters need, after an access check. */
export async function getExportData(timesheetId: string) {
  const me = await getMe();
  const ts = await getTimesheet(timesheetId);
  if (!ts || !(await canView(me, ts))) throw new Error("Not allowed.");
  return getBundle(ts);
}

// ---------- clients ----------

export async function addClient() {
  return wrap(async () => {
    const me = await getMe();
    const { data } = await db()
      .from("clients")
      .insert({ owner_id: me.id, company_name: "New client" })
      .select("id")
      .single();
    // a freshly added client becomes the one used on the open timesheet
    const open = (await getTimesheets(me.id)).find((t) => EDITABLE.includes(t.status));
    if (open && data) await db().from("timesheets").update({ client_id: data.id }).eq("id", open.id);
  });
}

const CLIENT_FIELDS = ["company_name", "contact_name", "contact_title", "contact_email", "project_name", "project_code"] as const;

export async function updateClient(clientId: string, field: (typeof CLIENT_FIELDS)[number], value: string) {
  return wrap(async () => {
    const me = await getMe();
    if (!CLIENT_FIELDS.includes(field)) throw new Error("Unknown field.");
    const { error } = await db()
      .from("clients")
      .update({ [field]: value.trim() })
      .eq("id", clientId)
      .eq("owner_id", me.id);
    if (error) throw error;
    if (field === "project_code") {
      // keep the open sheet's reference code in step with the project code
      const sheets = (await getTimesheets(me.id)).filter((t) => t.client_id === clientId && EDITABLE.includes(t.status));
      for (const t of sheets)
        await db().from("timesheets").update({ code: timesheetCode(value, t.period_end, me.full_name) }).eq("id", t.id);
    }
  });
}

export async function removeClient(clientId: string) {
  return wrap(async () => {
    const me = await getMe();
    const clients = await getClients(me.id);
    if (clients.length <= 1) throw new Error("At least one client must remain.");
    const used = (await getTimesheets(me.id)).some((t) => t.client_id === clientId && !EDITABLE.includes(t.status));
    if (used) throw new Error("This client is on a submitted timesheet and can't be removed.");
    const fallback = clients.find((c) => c.id !== clientId)!;
    await db().from("timesheets").update({ client_id: fallback.id }).eq("employee_id", me.id).eq("client_id", clientId);
    await db().from("clients").delete().eq("id", clientId).eq("owner_id", me.id);
  });
}

export async function useClient(timesheetId: string, clientId: string) {
  return wrap(async () => {
    const { me, ts } = await editableSheet(timesheetId);
    const client = (await getClients(me.id)).find((c) => c.id === clientId);
    if (!client) throw new Error("Client not found.");
    await db()
      .from("timesheets")
      .update({ client_id: client.id, code: timesheetCode(client.project_code, ts.period_end, me.full_name) })
      .eq("id", ts.id);
    await logEvent(ts.id, ...actor(me), "Client changed", ts.status, client.company_name);
  });
}

// ---------- phases ----------

export async function addPhase(name: string) {
  return wrap(async () => {
    const me = await getMe();
    if (!name.trim()) throw new Error("Enter a phase name.");
    const phases = await getPhases(me.id);
    const order = Math.max(0, ...phases.map((p) => p.sort_order)) + 1;
    await db().from("phases").insert({ owner_id: me.id, name: name.trim(), sort_order: order, is_current: phases.length === 0 });
  });
}

export async function renamePhase(phaseId: string, name: string) {
  return wrap(async () => {
    const me = await getMe();
    if (!name.trim()) throw new Error("Phase name can't be empty.");
    await db().from("phases").update({ name: name.trim() }).eq("id", phaseId).eq("owner_id", me.id);
    // entries on open sheets follow the new name; submitted sheets keep theirs
    const open = (await getTimesheets(me.id)).filter((t) => EDITABLE.includes(t.status)).map((t) => t.id);
    if (open.length) await db().from("time_entries").update({ phase_name: name.trim() }).eq("phase_id", phaseId).in("timesheet_id", open);
  });
}

export async function setCurrentPhase(phaseId: string) {
  return wrap(async () => {
    const me = await getMe();
    await db().from("phases").update({ is_current: false }).eq("owner_id", me.id);
    await db().from("phases").update({ is_current: true }).eq("id", phaseId).eq("owner_id", me.id);
  });
}

export async function removePhase(phaseId: string) {
  return wrap(async () => {
    const me = await getMe();
    const { count } = await db().from("time_entries").select("id", { count: "exact", head: true }).eq("phase_id", phaseId);
    if (count) throw new Error("This phase has hours logged against it. Move or remove those entries first.");
    await db().from("phases").delete().eq("id", phaseId).eq("owner_id", me.id);
  });
}
