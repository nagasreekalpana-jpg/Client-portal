"use client";

import { usePathname, useRouter } from "next/navigation";

export type PickerOption = { id: string; label: string };

/** Lets a manager switch which report's timesheet a page shows (?ts=). */
export function SheetPicker({ options, value }: { options: PickerOption[]; value: string }) {
  const router = useRouter();
  const path = usePathname();
  if (options.length < 2) return null;
  return (
    <select className="input w-auto max-w-full" value={value} onChange={(e) => router.push(`${path}?ts=${e.target.value}`)}>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
