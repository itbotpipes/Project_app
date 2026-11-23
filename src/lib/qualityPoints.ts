/**
 * TaskFlow Quality-Based Reward Points System
 *
 * Base Points by Task Size:
 * - Small / Easy: 5 points
 * - Medium: 10 points
 * - Large / Difficult: 20 points
 * - Extra Large / Complex: 30 points
 *
 * Priority Multipliers:
 * - Low: 1.0x
 * - Medium: 1.2x
 * - High: 1.5x
 * - Urgent / Critical: 2.0x
 *
 * Formula:
 * Base Points = Task Size Base * Priority Multiplier
 * Total Approved Points = Base Points + Manager Quality Bonus Points
 */

export const TASK_SIZE_BASE_POINTS: Record<string, number> = {
  SMALL: 5,
  EASY: 5,
  MEDIUM: 10,
  LARGE: 20,
  DIFFICULT: 20,
  XLARGE: 30,
  COMPLEX: 30,
};

export const PRIORITY_MULTIPLIERS: Record<string, number> = {
  LOW: 1.0,
  MEDIUM: 1.2,
  HIGH: 1.5,
  URGENT: 2.0,
};

export interface PointsBreakdown {
  sizeKey: string;
  sizeName: string;
  sizeBase: number;
  priorityKey: string;
  priorityName: string;
  multiplier: number;
  basePoints: number;
  qualityBonus: number;
  totalPoints: number;
}

export function normalizeSizeKey(sizeLabel?: string | null): string {
  if (!sizeLabel) return "MEDIUM";
  const upper = sizeLabel.toUpperCase().trim();
  if (upper.includes("COMPLEX") || upper.includes("XLARGE") || upper === "XL") return "COMPLEX";
  if (upper.includes("LARGE") || upper.includes("DIFFICULT")) return "LARGE";
  if (upper.includes("SMALL") || upper.includes("EASY")) return "SMALL";
  return "MEDIUM";
}

export function normalizePriorityKey(
  priority?: string | null,
  urgent?: boolean,
  important?: boolean
): string {
  if (urgent && important) return "URGENT";
  if (urgent) return "URGENT";
  if (important) return "HIGH";

  if (!priority) return "MEDIUM";
  const upper = priority.toUpperCase().trim();
  if (upper.includes("URGENT") || upper.includes("CRITICAL")) return "URGENT";
  if (upper.includes("HIGH") || upper.includes("IMPORTANT")) return "HIGH";
  if (upper.includes("LOW")) return "LOW";
  return "MEDIUM";
}

export function computeTaskPoints(options: {
  sizeLabel?: string | null;
  priority?: string | null;
  urgent?: boolean;
  important?: boolean;
  qualityBonusPoints?: number | null;
}): PointsBreakdown {
  const sizeKey = normalizeSizeKey(options.sizeLabel);
  const sizeBase = TASK_SIZE_BASE_POINTS[sizeKey] ?? 10;
  const sizeName =
    sizeKey === "COMPLEX"
      ? "Complex / XL (30 pts)"
      : sizeKey === "LARGE"
      ? "Large (20 pts)"
      : sizeKey === "SMALL"
      ? "Small (5 pts)"
      : "Medium (10 pts)";

  const priorityKey = normalizePriorityKey(options.priority, options.urgent, options.important);
  const multiplier = PRIORITY_MULTIPLIERS[priorityKey] ?? 1.2;
  const priorityName =
    priorityKey === "URGENT"
      ? "Urgent (2.0x)"
      : priorityKey === "HIGH"
      ? "High (1.5x)"
      : priorityKey === "LOW"
      ? "Low (1.0x)"
      : "Medium (1.2x)";

  const basePoints = Math.round(sizeBase * multiplier * 10) / 10;
  const qualityBonus = Math.max(0, Number(options.qualityBonusPoints || 0));
  const totalPoints = Math.round((basePoints + qualityBonus) * 10) / 10;

  return {
    sizeKey,
    sizeName,
    sizeBase,
    priorityKey,
    priorityName,
    multiplier,
    basePoints,
    qualityBonus,
    totalPoints,
  };
}
