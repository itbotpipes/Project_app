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
