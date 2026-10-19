import { SheetPicker } from "@/components/sheet-picker";
import { Empty, PageHeader } from "@/components/ui";
import { getClients } from "@/lib/data";
import { EDITABLE } from "@/lib/domain";
import { loadPageSheet } from "@/lib/page-sheet";
import { ProjectClient } from "./project-client";

export default async function ProjectClientPage({ searchParams }: { searchParams: Promise<{ ts?: string }> }) {
  const { ts: tsParam } = await searchParams;
  const { me, bundle, options } = await loadPageSheet(tsParam);
  if (!bundle) return <Empty title="No timesheets yet" />;
  const own = bundle.ts.employee_id === me.id;
  const clients = own ? await getClients(me.id) : bundle.client ? [bundle.client] : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Project & client"
        subtitle={
          own
            ? "Used on the timesheet, PDF, Excel export and client email. Changes apply instantly."
            : `${bundle.employee.full_name}'s project and client details (read-only)`
        }
      >
        <SheetPicker options={options} value={bundle.ts.id} />
      </PageHeader>
      <ProjectClient
        ts={bundle.ts}
        clients={clients}
        selectedId={bundle.client?.id ?? null}
        phases={bundle.phases}
        entries={bundle.entries}
        canEditSetup={own}
        canEditHours={own && EDITABLE.includes(bundle.ts.status)}
      />
    </div>
  );
}
