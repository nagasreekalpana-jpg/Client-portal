import "server-only";
import { getBundle, getMe, getTeamSheets, resolveSheet } from "./data";
import { STATUS_LABEL, fmtH, fmtRange } from "./domain";
import type { PickerOption } from "@/components/sheet-picker";

/** Loads the timesheet a shared page (summary/preview) should display. */
export async function loadPageSheet(tsParam?: string) {
  const me = await getMe();
  const ts = await resolveSheet(me, tsParam);
  if (!ts) return { me, bundle: null, options: [] as PickerOption[] };
  const bundle = await getBundle(ts);
  let options: PickerOption[] = [];
  if (me.role === "manager") {
    options = (await getTeamSheets(me.id)).map((s) => ({
      id: s.ts.id,
      label: `${s.employee.full_name} · ${fmtRange(s.ts.period_start, s.ts.period_end)} · ${fmtH(s.hours)} h · ${STATUS_LABEL[s.ts.status]}`,
    }));
  }
  return { me, bundle, options };
}
