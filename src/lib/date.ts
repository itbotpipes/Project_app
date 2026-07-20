/** Monday 00:00 of the week containing `date`. */
export function mondayOf(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - day);
  return d;
}

/** 1st of the month containing `date`, at 00:00. */
export function monthStartOf(date = new Date()): Date {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** 1st of last month, at 00:00 — the default period for "score last month". */
export function previousMonthStart(date = new Date()): Date {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

/** Compact "2h ago" / "just now" relative time for comments & wishes. */
export function relativeTime(from: Date, now = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - new Date(from).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
