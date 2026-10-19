import { redirect } from "next/navigation";
import { getBundle, getCurrentTimesheet, getMe } from "@/lib/data";
import { summarize } from "@/lib/domain";
import { TimeEntry } from "./time-entry";

export default async function TimeEntryPage() {
  const me = await getMe();
  if (me.role === "manager") redirect("/review");
  const ts = await getCurrentTimesheet(me);
  const b = await getBundle(ts);
  const s = summarize(ts, b.entries, me.weekly_target);
  return (
    <TimeEntry
      ts={ts}
      entries={b.entries}
      phases={b.phases}
      weeks={s.weeks}
      total={s.total}
      checks={s.checks}
      canSubmit={s.canSubmit}
      managerName={b.manager?.full_name ?? "your manager"}
    />
  );
}
