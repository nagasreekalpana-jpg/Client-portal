"use client";

import { useState } from "react";
import { getExportData } from "@/lib/actions";
import { downloadExcel, downloadPdf } from "@/lib/export";

export function Downloads({ timesheetId, small }: { timesheetId: string; small?: boolean }) {
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const cls = `btn-ghost ${small ? "btn-sm" : ""}`;

  async function run(kind: "pdf" | "xlsx") {
    setBusy(kind);
    try {
      const bundle = await getExportData(timesheetId);
      await (kind === "pdf" ? downloadPdf(bundle) : downloadExcel(bundle));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button className={cls} disabled={!!busy} onClick={() => run("pdf")}>
        {busy === "pdf" ? "Preparing…" : small ? "PDF" : "Download PDF"}
      </button>
      <button className={cls} disabled={!!busy} onClick={() => run("xlsx")}>
        {busy === "xlsx" ? "Preparing…" : small ? "Excel" : "Download Excel"}
      </button>
    </>
  );
}
