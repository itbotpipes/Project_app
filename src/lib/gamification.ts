// Streak & badge helpers (behavioural gamification)

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Consecutive days (ending today or yesterday) on which the user closed >=1 task. */
export function computeStreak(completedDates: Date[]): number {
  const days = new Set(completedDates.map(dayKey));
  if (days.size === 0) return 0;

  const today = new Date();
  const cursor = new Date(today);
  // allow the streak to be "alive" if they finished something today or yesterday
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export type Badge = { icon: string; label: string };

export function streakBadges(streak: number): Badge[] {
  const out: Badge[] = [];
  if (streak >= 3) out.push({ icon: "🔥", label: "On a roll" });
  if (streak >= 5) out.push({ icon: "⭐", label: "Efficient Star" });
  if (streak >= 20) out.push({ icon: "⚡", label: "Consistency King/Queen" });
  return out;
}

/** Upcoming birthdays within `withinDays` (ignores year). */
export function upcomingBirthdays<T extends { name: string; birthday: Date | null }>(
  people: T[],
  withinDays = 14,
): { name: string; date: Date; inDays: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: { name: string; date: Date; inDays: number }[] = [];
  for (const p of people) {
    if (!p.birthday) continue;
    const b = new Date(p.birthday);
    const next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    const inDays = Math.round((next.getTime() - today.getTime()) / 86400000);
    if (inDays <= withinDays) out.push({ name: p.name, date: next, inDays });
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}
