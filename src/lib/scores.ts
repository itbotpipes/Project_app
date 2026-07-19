import { MONTHS } from "./constants";

export function monthLabel(year: number, month: number) {
  return `${MONTHS[month - 1]} ${String(year).slice(2)}`;
}

/** Average of the most recent N monthly totals (used for increment band). */
export function recentAverage(
  cards: { year: number; month: number; total: number }[],
  n = 6,
) {
  const sorted = [...cards].sort((a, b) =>
    a.year === b.year ? a.month - b.month : a.year - b.year,
  );
  const last = sorted.slice(-n);
  if (!last.length) return 0;
  return last.reduce((s, c) => s + c.total, 0) / last.length;
}
