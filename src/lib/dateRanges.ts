export type RangeType =
  | "daily"
  | "specific"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export type DateRangeResult = {
  rangeType: RangeType;
  startDate: Date;
  endDate: Date;
  label: string;
  subLabel?: string;
  dateParam: string; // YYYY-MM-DD anchor
  fromParam?: string;
  toParam?: string;
  prevParams: Record<string, string>;
  nextParams: Record<string, string>;
};

export type DateRangeInput = {
  range?: string | null;
  date?: string | null; // YYYY-MM-DD
  from?: string | null; // YYYY-MM-DD
  to?: string | null; // YYYY-MM-DD
  year?: string | number | null;
  month?: string | number | null;
  quarter?: string | number | null;
};

export function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYMD(str?: string | null, fallback: Date = new Date()): Date {
  if (!str) return new Date(fallback);
  const parts = str.split("-");
  if (parts.length >= 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }
  return new Date(fallback);
}

/**
 * Centralized date range calculator for employee work reports.
 * Returns exact start (00:00:00.000) and end (23:59:59.999) timestamps, formatted labels, and prev/next navigation parameters.
 */
export function getReportRange(input: DateRangeInput = {}): DateRangeResult {
  const rawType = (input.range || "daily").toLowerCase() as RangeType;
  const validTypes: RangeType[] = ["daily", "specific", "weekly", "monthly", "quarterly", "yearly", "custom"];
  const rangeType: RangeType = validTypes.includes(rawType) ? rawType : "daily";

  const now = new Date();
  const anchorDate = parseYMD(input.date, now);

  if (rangeType === "daily" || rangeType === "specific") {
    const startDate = new Date(anchorDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);

    const prevDate = new Date(startDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const nextDate = new Date(startDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const isToday = formatYMD(startDate) === formatYMD(now);
    const label = startDate.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return {
      rangeType,
      startDate,
      endDate,
      label: isToday ? `Today (${label})` : label,
      subLabel: isToday ? "Live Daily View" : "Single Date Analysis",
      dateParam: formatYMD(startDate),
      prevParams: { range: rangeType, date: formatYMD(prevDate) },
      nextParams: { range: rangeType, date: formatYMD(nextDate) },
    };
  }

  if (rangeType === "weekly") {
    // Week starts on Monday
    const currentDay = anchorDate.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    const startDate = new Date(anchorDate);
    startDate.setDate(anchorDate.getDate() + distanceToMonday);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const prevWeek = new Date(startDate);
    prevWeek.setDate(prevWeek.getDate() - 7);
    const nextWeek = new Date(startDate);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const startLabel = startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const endLabel = endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    return {
      rangeType: "weekly",
      startDate,
      endDate,
      label: `${startLabel} – ${endLabel}`,
      subLabel: "7-Day Weekly Workload",
      dateParam: formatYMD(anchorDate),
      prevParams: { range: "weekly", date: formatYMD(prevWeek) },
      nextParams: { range: "weekly", date: formatYMD(nextWeek) },
    };
  }

  if (rangeType === "monthly") {
    const year = input.year ? parseInt(String(input.year), 10) : anchorDate.getFullYear();
    const month = input.month ? parseInt(String(input.month), 10) - 1 : anchorDate.getMonth();

    const startDate = new Date(year, month, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const prevMonth = new Date(year, month - 1, 1);
    const nextMonth = new Date(year, month + 1, 1);

    const label = startDate.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });

    return {
      rangeType: "monthly",
      startDate,
      endDate,
      label,
      subLabel: "Monthly Summary",
      dateParam: formatYMD(startDate),
      prevParams: { range: "monthly", date: formatYMD(prevMonth) },
      nextParams: { range: "monthly", date: formatYMD(nextMonth) },
    };
  }

  if (rangeType === "quarterly") {
    const year = input.year ? parseInt(String(input.year), 10) : anchorDate.getFullYear();
    let q = input.quarter ? parseInt(String(input.quarter), 10) : Math.floor(anchorDate.getMonth() / 3) + 1;
    if (q < 1 || q > 4) q = 1;

    const startMonth = (q - 1) * 3;
    const endMonth = startMonth + 2;

    const startDate = new Date(year, startMonth, 1, 0, 0, 0, 0);
    const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);

    const prevQDate = new Date(year, startMonth - 3, 1);
    const nextQDate = new Date(year, startMonth + 3, 1);

    const qMonths = [
      "Jan – Mar",
      "Apr – Jun",
      "Jul – Sep",
      "Oct – Dec",
    ][q - 1];

    return {
      rangeType: "quarterly",
      startDate,
      endDate,
      label: `Q${q} ${year}`,
      subLabel: `${qMonths} ${year}`,
      dateParam: formatYMD(startDate),
      prevParams: { range: "quarterly", date: formatYMD(prevQDate) },
      nextParams: { range: "quarterly", date: formatYMD(nextQDate) },
    };
  }

  if (rangeType === "yearly") {
    const year = input.year ? parseInt(String(input.year), 10) : anchorDate.getFullYear();
    const startDate = new Date(year, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const prevYear = new Date(year - 1, 0, 1);
    const nextYear = new Date(year + 1, 0, 1);

    return {
      rangeType: "yearly",
      startDate,
      endDate,
      label: `Year ${year}`,
      subLabel: "Full Year Operations",
      dateParam: formatYMD(startDate),
      prevParams: { range: "yearly", date: formatYMD(prevYear) },
      nextParams: { range: "yearly", date: formatYMD(nextYear) },
    };
  }

  // Custom Range
  const startDate = parseYMD(input.from, new Date(now.getFullYear(), now.getMonth(), 1));
  startDate.setHours(0, 0, 0, 0);

  const endDate = parseYMD(input.to, now);
  endDate.setHours(23, 59, 59, 999);

  // If user inverted from/to, fix gracefully
  const finalStart = startDate.getTime() <= endDate.getTime() ? startDate : endDate;
  const finalEnd = startDate.getTime() <= endDate.getTime() ? endDate : startDate;

  const startLabel = finalStart.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const endLabel = finalEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return {
    rangeType: "custom",
    startDate: finalStart,
    endDate: finalEnd,
    label: `${startLabel} – ${endLabel}`,
    subLabel: "Custom Date Filter",
    dateParam: formatYMD(finalStart),
    fromParam: formatYMD(finalStart),
    toParam: formatYMD(finalEnd),
    prevParams: { range: "custom", from: formatYMD(finalStart), to: formatYMD(finalEnd) },
    nextParams: { range: "custom", from: formatYMD(finalStart), to: formatYMD(finalEnd) },
  };
}
