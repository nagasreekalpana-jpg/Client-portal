// Client-side PDF and Excel generation for a timesheet bundle.
import type { Bundle } from "./data";
import { STATUS_LABEL, dayName, fmtDate, fmtDay, fmtH, fmtShortRange, istDate, pct, summarize } from "./domain";

function fileBase(b: Bundle) {
  return `${b.ts.code}-v${b.ts.version}`;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function buildPdf(b: Bundle) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const { ts, entries, employee, client, manager } = b;
  const s = summarize(ts, entries, employee.weekly_target);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const navy: [number, number, number] = [15, 26, 46];

  // header
  doc.setFillColor(...navy);
  doc.roundedRect(M, M, 30, 30, 4, 4, "F");
  doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(14).text((employee.company || "H")[0], M + 15, M + 20, { align: "center" });
  doc.setTextColor(...navy).setFontSize(13).text(employee.company.toUpperCase(), M + 40, M + 13);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100).text("IT Services · Hyderabad, India", M + 40, M + 26);
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...navy).text("TIMESHEET", W - M, M + 14, { align: "right" });
  doc.setFont("courier", "normal").setFontSize(8).setTextColor(100).text(`${ts.code} · v${ts.version} · ${STATUS_LABEL[ts.status]}`, W - M, M + 28, { align: "right" });
  doc.setDrawColor(...navy).setLineWidth(1.5).line(M, M + 42, W - M, M + 42);

  // details
  const phases = [...new Set(entries.map((e) => e.phase_name).filter(Boolean))].join(", ") || "—";
  const left: [string, string][] = [
    ["Employee", employee.full_name],
    ["Designation", employee.designation || "—"],
    ["Reporting manager", manager?.full_name ?? "—"],
    ["Company", employee.company],
  ];
  const right: [string, string][] = [
    ["Client", client?.company_name ?? "—"],
    ["Client contact", [client?.contact_name, client?.contact_title].filter(Boolean).join(", ") || "—"],
    ["Project", client?.project_name || "—"],
    ["Project code", client?.project_code || "—"],
    ["Phase(s)", phases],
    ["Period", `${fmtDate(ts.period_start)} – ${fmtDate(ts.period_end)}`],
  ];
  let y = M + 62;
  doc.setFontSize(9);
  left.forEach(([k, v], i) => {
    doc.setFont("helvetica", "normal").setTextColor(110).text(k, M, y + i * 15);
    doc.setFont("helvetica", "bold").setTextColor(20).text(v, M + 95, y + i * 15);
  });
  right.forEach(([k, v], i) => {
    doc.setFont("helvetica", "normal").setTextColor(110).text(k, W / 2 + 10, y + i * 15);
    doc.setFont("helvetica", i === 0 || i === 5 ? "bold" : "normal").setTextColor(20);
    doc.text(doc.splitTextToSize(v, W / 2 - M - 95)[0], W / 2 + 95, y + i * 15);
  });
  y += right.length * 15 + 10;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Total hours", "Working days", "Avg per day", "Entries"]],
    body: [[fmtH(s.total), String(s.loggedDays), fmtH(s.avgPerDay), String(entries.length)]],
    theme: "grid",
    styles: { fontSize: 9, halign: "center" },
    headStyles: { fillColor: [232, 238, 252], textColor: 80, fontStyle: "normal" },
    bodyStyles: { fontSize: 14, fontStyle: "bold" },
  });

  // entries grouped by week with subtotals
  const body: (string | { content: string; colSpan?: number; styles?: object })[][] = [];
  for (const w of s.weeks) {
    for (const e of entries.filter((x) => x.entry_date >= w.start && x.entry_date <= w.end))
      body.push([fmtDay(e.entry_date), dayName(e.entry_date), e.category, e.phase_name.split(/\s[–-]\s/)[0] || "—", e.description, fmtH(e.hours)]);
    body.push([
      { content: `Week ${w.index} subtotal · ${fmtShortRange(w.start, w.end)}`, colSpan: 5, styles: { fontStyle: "bold", fillColor: [243, 245, 248] } },
      { content: fmtH(w.hours), styles: { fontStyle: "bold", fillColor: [243, 245, 248], halign: "right" } },
    ]);
  }
  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18,
    margin: { left: M, right: M },
    head: [["Date", "Day", "Category", "Phase", "Task description", "Hours"]],
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: navy },
    columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 30 }, 2: { cellWidth: 95 }, 3: { cellWidth: 50 }, 5: { halign: "right", cellWidth: 40 } },
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18,
    margin: { left: M, right: M },
    head: [["Week", "Dates", "Hours", "%"]],
    body: [
      ...s.weeks.map((w) => [w.label, fmtShortRange(w.start, w.end), fmtH(w.hours), `${pct(w.hours, s.total).toFixed(1)}%`]),
      ["Total", "", fmtH(s.total), "100%"],
      ...s.categories.map((c) => [c.name, "category", fmtH(c.hours), `${pct(c.hours, s.total).toFixed(1)}%`]),
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: navy },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  if (y > doc.internal.pageSize.getHeight() - 140) {
    doc.addPage();
    y = M;
  }
  doc.setFillColor(...navy).rect(M, y, W - 2 * M, 34, "F");
  doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(10).text("TOTAL HOURS FOR THE PERIOD", M + 12, y + 21);
  doc.setFontSize(15).text(`${fmtH(s.total)} hrs`, W - M - 12, y + 22, { align: "right" });

  y += 80;
  doc.setTextColor(20).setDrawColor(20).setLineWidth(0.6);
  const col = (W - 2 * M - 30) / 2;
  const sign = (x: number, title: string, name: string, date: string | null) => {
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(110).text(title.toUpperCase(), x, y - 40);
    doc.line(x, y, x + col, y);
    doc.setFontSize(9).setTextColor(20).text(name, x, y + 13);
    doc.setFont("helvetica", "normal").text(`Date: ${date ? fmtDate(istDate(date)) : "__________"}`, x + col, y + 13, { align: "right" });
  };
  sign(M, `Reporting manager · ${employee.company}`, manager?.full_name ?? "—", ts.approved_at);
  sign(M + col + 30, `Shared with client · ${client?.company_name ?? ""}`, [client?.contact_name, client?.contact_title].filter(Boolean).join(", ") || "—", ts.shared_at);

  doc.setFontSize(7).setTextColor(130).text(`Generated by TimeSheet Pro · totals calculated automatically from daily entries · ${ts.code}`, M, y + 45);
  return doc;
}

export async function downloadPdf(b: Bundle) {
  const doc = await buildPdf(b);
  doc.save(`${fileBase(b)}.pdf`);
}

export async function buildExcel(b: Bundle) {
  const ExcelJS = (await import("exceljs")).default;
  const { ts, entries, employee, client, manager } = b;
  const s = summarize(ts, entries, employee.weekly_target);
  const wb = new ExcelJS.Workbook();
  wb.creator = "TimeSheet Pro";

  const info = wb.addWorksheet("Summary");
  info.columns = [{ width: 22 }, { width: 48 }];
  const rows: [string, string | number][] = [
    ["Timesheet", ts.code],
    ["Version", `v${ts.version}`],
    ["Status", STATUS_LABEL[ts.status]],
    ["Employee", employee.full_name],
    ["Designation", employee.designation],
    ["Reporting manager", manager?.full_name ?? ""],
    ["Client", client?.company_name ?? ""],
    ["Client contact", [client?.contact_name, client?.contact_title].filter(Boolean).join(", ")],
    ["Project", client?.project_name ?? ""],
    ["Project code", client?.project_code ?? ""],
    ["Period", `${fmtDate(ts.period_start)} – ${fmtDate(ts.period_end)}`],
    ["Total hours", s.total],
    ["Working days", s.loggedDays],
    ["Average per day", s.avgPerDay],
  ];
  rows.forEach((r) => info.addRow(r));
  info.getColumn(1).font = { bold: true };

  const sheet = wb.addWorksheet("Daily entries");
  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Day", key: "day", width: 6 },
    { header: "Week", key: "week", width: 7 },
    { header: "Category", key: "category", width: 32 },
    { header: "Phase", key: "phase", width: 28 },
    { header: "Task description", key: "description", width: 60 },
    { header: "Hours", key: "hours", width: 9 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F1A2E" } };
  for (const w of s.weeks) {
    const first = sheet.rowCount + 1;
    for (const e of entries.filter((x) => x.entry_date >= w.start && x.entry_date <= w.end))
      sheet.addRow({ date: e.entry_date, day: dayName(e.entry_date), week: w.label, category: e.category, phase: e.phase_name, description: e.description, hours: e.hours });
    const last = sheet.rowCount;
    const sub = sheet.addRow({ description: `Week ${w.index} subtotal · ${fmtShortRange(w.start, w.end)}` });
    sub.getCell("hours").value = last >= first ? { formula: `SUM(G${first}:G${last})`, result: w.hours } : 0;
    sub.font = { bold: true };
    sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F5F8" } };
  }
  const total = sheet.addRow({ description: "Total hours for the period", hours: s.total });
  total.font = { bold: true };

  const cats = wb.addWorksheet("By category");
  cats.columns = [
    { header: "Category", key: "c", width: 34 },
    { header: "Hours", key: "h", width: 10 },
    { header: "% of total", key: "p", width: 12 },
  ];
  cats.getRow(1).font = { bold: true };
  s.categories.forEach((c) => cats.addRow({ c: c.name, h: c.hours, p: Number(pct(c.hours, s.total).toFixed(1)) }));

  return wb.xlsx.writeBuffer();
}

export async function downloadExcel(b: Bundle) {
  const buf = await buildExcel(b);
  save(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileBase(b)}.xlsx`);
}
