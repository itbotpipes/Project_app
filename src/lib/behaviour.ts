// The 6 human-judged behaviour aspects. These can NEVER be auto-computed — they are
// always filled in by the Head of Department, HR, or COO. Each is scored 0–10.
export const BEHAVIOUR_ASPECTS = [
  { key: "attendance", label: "Attendance & availability", icon: "📅" },
  { key: "punctuality", label: "Punctuality & discipline", icon: "⏰" },
  { key: "learning", label: "Continuous learning", icon: "📚" },
  { key: "helpfulness", label: "Helpfulness & teamwork", icon: "🤝" },
  { key: "trust", label: "Trust & long-term commitment", icon: "🛡️" },
  { key: "conduct", label: "Cordial & positive conduct", icon: "😊" },
] as const;

export type BehaviourKey = (typeof BEHAVIOUR_ASPECTS)[number]["key"];

export type BehaviourFields = Record<BehaviourKey, number>;

/** Mean of the six aspects, 0–10. */
export function behaviourAverage(r: Partial<BehaviourFields> | null | undefined): number {
  if (!r) return 0;
  const vals = BEHAVIOUR_ASPECTS.map((a) => Number(r[a.key] ?? 0));
  const sum = vals.reduce((s, v) => s + v, 0);
  return Math.round((sum / BEHAVIOUR_ASPECTS.length) * 10) / 10;
}

/** Behaviour as a 0–100 percentage (used by the increment projection). */
export function behaviourPct(r: Partial<BehaviourFields> | null | undefined): number {
  return Math.round(behaviourAverage(r) * 10);
}

/** Average behaviour across many monthly reviews (e.g. a whole year), 0–100. */
export function behaviourPctFromMany(reviews: Partial<BehaviourFields>[]): number | null {
  if (!reviews.length) return null;
  const avg = reviews.reduce((s, r) => s + behaviourAverage(r), 0) / reviews.length;
  return Math.round(avg * 10);
}
