// Builds the PDF and Excel for one seeded timesheet to check the exporters.
import { createClient } from "@supabase/supabase-js";
import { buildExcel, buildPdf } from "../src/lib/export";
import type { Bundle } from "../src/lib/data";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: ts } = await db.from("timesheets").select("*").eq("status", "approved").limit(1).single();
  const [{ data: entries }, { data: employee }, { data: client }] = await Promise.all([
    db.from("time_entries").select("*").eq("timesheet_id", ts.id).order("entry_date"),
    db.from("profiles").select("*").eq("id", ts.employee_id).single(),
    db.from("clients").select("*").eq("id", ts.client_id).single(),
  ]);
  const { data: manager } = await db.from("profiles").select("*").eq("id", employee.manager_id).single();
  const b = { ts, entries: entries!.map((e) => ({ ...e, hours: Number(e.hours) })), audit: [], employee: { ...employee, weekly_target: 40 }, client, phases: [], manager } as unknown as Bundle;
  const pdf = await buildPdf(b);
  const xlsx = await buildExcel(b);
  console.log(`PDF pages=${pdf.getNumberOfPages()} bytes=${pdf.output("arraybuffer").byteLength}`);
  (await import("fs")).writeFileSync(process.argv[2] ?? "out.pdf", Buffer.from(pdf.output("arraybuffer")));
  console.log(`XLSX bytes=${(xlsx as ArrayBuffer).byteLength}`);
}
main();
