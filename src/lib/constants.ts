// Shared constants (enum-like values kept as strings for SQLite/Postgres portability)

export const SYSTEM_ROLES = ["ADMIN", "CEO", "MANAGER", "EMPLOYEE"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

// Kanban statuses, in board order
export const TASK_STATUS = {
  NEW: "NEW",
  ACCEPTED: "ACCEPTED",
  IN_PROGRESS: "IN_PROGRESS",
  ON_HOLD: "ON_HOLD",
  PENDING_REVIEW: "PENDING_REVIEW",
  CLOSED: "CLOSED",
  REOPENED: "REOPENED",
  CARRIED_FORWARD: "CARRIED_FORWARD",
} as const;
export type TaskStatus = keyof typeof TASK_STATUS;

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "NEW",
  "ACCEPTED",
  "IN_PROGRESS",
  "ON_HOLD",
  "PENDING_REVIEW",
  "CLOSED",
];

export const TASK_STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  PENDING_REVIEW: "Pending Review",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CARRIED_FORWARD: "Carried Forward",
};

export const TASK_SIZES = ["EASY", "MEDIUM", "DIFFICULT"] as const;

// Eisenhower priority quadrant from urgent/important flags
export function priorityQuadrant(urgent: boolean, important: boolean): string {
  if (urgent && important) return "Do First";
  if (!urgent && important) return "Schedule";
  if (urgent && !important) return "Delegate";
  return "Eliminate";
}

// Increment/bonus bands (from the company's own rules, 6-month consistency)
export function incrementBand(avgScore: number): { label: string; className: string } {
  if (avgScore >= 85) return { label: "20% bonus", className: "text-emerald-600" };
  if (avgScore >= 75) return { label: "15% bonus", className: "text-emerald-600" };
  if (avgScore >= 65) return { label: "10% increment", className: "text-blue-600" };
  return { label: "Below threshold", className: "text-slate-500" };
}

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
