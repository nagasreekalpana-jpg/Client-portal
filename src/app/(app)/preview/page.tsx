import { ActionButton } from "@/components/action-button";
import { Downloads } from "@/components/downloads";
import { SheetPicker } from "@/components/sheet-picker";
import { TimesheetDoc } from "@/components/timesheet-doc";
import { Empty, PageHeader } from "@/components/ui";
import { submitTimesheet } from "@/lib/actions";
import { EDITABLE } from "@/lib/domain";
import { loadPageSheet } from "@/lib/page-sheet";

export default async function Preview({ searchParams }: { searchParams: Promise<{ ts?: string }> }) {
  const { ts: tsParam } = await searchParams;
  const { me, bundle, options } = await loadPageSheet(tsParam);
  if (!bundle) return <Empty title="No timesheets yet">Your reports haven&apos;t started a timesheet.</Empty>;
  const { ts, client } = bundle;
  const own = ts.employee_id === me.id;

  return (
    <div className="space-y-5">
      <PageHeader title="Timesheet preview" subtitle={`Exactly what ${client?.company_name ?? "the client"} receives as a PDF`}>
        <SheetPicker options={options} value={ts.id} />
        <Downloads timesheetId={ts.id} />
        {own && EDITABLE.includes(ts.status) && <ActionButton action={submitTimesheet.bind(null, ts.id)}>Submit for approval</ActionButton>}
      </PageHeader>
      <TimesheetDoc bundle={bundle} />
    </div>
  );
}
