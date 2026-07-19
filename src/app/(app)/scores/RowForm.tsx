"use client";

import { useState } from "react";
import { saveManagerScore } from "@/lib/actions/managerScore";

export default function RowForm({
  employeeId,
  period,
  periodStart,
  initialScore,
  initialNote,
}: {
  employeeId: string;
  period: string;
  periodStart: string; // ISO date
  initialScore: number | null;
  initialNote: string | null;
}) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (fd) => {
        const res = await saveManagerScore(fd);
        if (res?.error) {
          setError(res.error);
          setSaved(false);
        } else {
          setError(null);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="periodStart" value={periodStart} />
      <input
        name="score"
        type="number"
        min="0"
        max="100"
        step="1"
        defaultValue={initialScore ?? ""}
        placeholder="/100"
        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
      />
      <input
        name="note"
        defaultValue={initialNote ?? ""}
        placeholder="Note (optional)"
        className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-56"
      />
      <button className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700">
        Save
      </button>
      {saved && <span className="text-xs text-emerald-600">✓</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
