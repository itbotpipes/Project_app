export type VoiceParseResult = {
  title: string;
  description?: string;
  assigneeIds: string[];
  priority?: "high" | "important-only" | "urgent-only" | "low";
  dueAt?: string; // Format YYYY-MM-DDTHH:mm
  kpiId?: string;
  sizeLabel?: "EASY" | "MEDIUM" | "DIFFICULT";
  summary: string[];
};

const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const DAYS_OF_WEEK: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

export function parseVoiceTaskCommand(
  rawTranscript: string,
  people: { id: string; name: string }[],
  kpiOptions: { id: string; kpiName: string }[]
): VoiceParseResult {
  const text = rawTranscript.trim();
  let lower = text.toLowerCase();
  const summary: string[] = [];

  // Used to track phrases to strip out of the final task title
  const phrasesToRemove: string[] = [];

  // 1. Assignee Extraction
  const matchedAssignees: string[] = [];
  const assignedNames: string[] = [];

  for (const p of people) {
    const pName = p.name.trim();
    const firstName = pName.split(" ")[0].toLowerCase();
    const fullNameLower = pName.toLowerCase();

    const nameRegex = new RegExp(`\\b${firstName}\\b`, "i");
    if (lower.includes(fullNameLower) || nameRegex.test(lower)) {
      if (!matchedAssignees.includes(p.id)) {
        matchedAssignees.push(p.id);
        assignedNames.push(p.name);

        // Record assignee phrase for title cleanup (e.g., "to Aditya", "assigned to Aditya")
        const assignPhraseRegex = new RegExp(`\\b(assigned\\s+to|assign\\s+to|to|for)?\\s*(${fullNameLower}|${firstName})\\b`, "gi");
        const matches = lower.match(assignPhraseRegex);
        if (matches) {
          phrasesToRemove.push(...matches);
        }
      }
    }
  }

  if (assignedNames.length > 0) {
    summary.push(`Assigned to: ${assignedNames.join(", ")}`);
  }

  // 2. Priority Extraction
  let priority: "high" | "important-only" | "urgent-only" | "low" | undefined = undefined;

  const prioRegexes: { pattern: RegExp; val: "high" | "important-only" | "urgent-only" | "low"; label: string }[] = [
    { pattern: /\b(high|critical|top priority|urgent and important)\s*(priority)?\b/gi, val: "high", label: "Priority: High" },
    { pattern: /\b(urgent|asap|emergency)\s*(priority)?\b/gi, val: "urgent-only", label: "Priority: Medium (Urgent)" },
    { pattern: /\b(important|vital|key)\s*(priority)?\b/gi, val: "important-only", label: "Priority: Medium (Important)" },
    { pattern: /\b(low|minor|whenever)\s*(priority)?\b/gi, val: "low", label: "Priority: Low" },
  ];

  for (const pItem of prioRegexes) {
    const matches = lower.match(pItem.pattern);
    if (matches) {
      priority = pItem.val;
      summary.push(pItem.label);
      phrasesToRemove.push(...matches);
      break;
    }
  }

  // 3. Due Date Extraction (Comprehensive Natural Language Date Parsing)
  let dueAt: string | undefined = undefined;
  const now = new Date();

  // Helper date formatter
  const formatDateStr = (d: Date) => formatForDateTimeInput(d);

  // Date Parsing Logic:
  // a) Relative Dates (today, tomorrow, in X days, next Monday)
  let dateMatchedStr: string | null = null;

  if (/\b(today|tonight|by end of day)\b/i.test(lower)) {
    const m = lower.match(/\b(due date|due on|due|deadline|by|on)?\s*(today|tonight|by end of day)\b/i);
    dateMatchedStr = m ? m[0] : "today";
    const due = new Date(now);
    due.setHours(18, 0, 0, 0);
    dueAt = formatDateStr(due);
    summary.push("Due: Today 6:00 PM");
  } else if (/\b(tomorrow|by tomorrow)\b/i.test(lower)) {
    const m = lower.match(/\b(due date|due on|due|deadline|by|on)?\s*(tomorrow|by tomorrow)\b/i);
    dateMatchedStr = m ? m[0] : "tomorrow";
    const due = new Date(now);
    due.setDate(due.getDate() + 1);
    due.setHours(18, 0, 0, 0);
    dueAt = formatDateStr(due);
    summary.push("Due: Tomorrow 6:00 PM");
  } else {
    // Check "in X days"
    const inDaysMatch = lower.match(/\b(due date|due on|due|deadline|by|on)?\s*in (\d+) days?\b/i);
    if (inDaysMatch) {
      dateMatchedStr = inDaysMatch[0];
      const days = parseInt(inDaysMatch[2], 10);
      const due = new Date(now);
      due.setDate(due.getDate() + days);
      due.setHours(18, 0, 0, 0);
      dueAt = formatDateStr(due);
      summary.push(`Due: In ${days} days`);
    } else {
      // Check Day of Week (e.g., "next Monday", "this Friday", "on Wednesday")
      const dayOfWeekMatch = lower.match(/\b(due date|due on|due|deadline|by|on)?\s*(this|next)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i);
      if (dayOfWeekMatch && dayOfWeekMatch[3]) {
        const targetDay = DAYS_OF_WEEK[dayOfWeekMatch[3].toLowerCase()];
        if (targetDay !== undefined) {
          dateMatchedStr = dayOfWeekMatch[0];
          const due = new Date(now);
          let diff = targetDay - due.getDay();
          if (diff <= 0) diff += 7;
          due.setDate(due.getDate() + diff);
          due.setHours(18, 0, 0, 0);
          dueAt = formatDateStr(due);
          summary.push(`Due: ${due.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}`);
        }
      }
    }
  }

  // b) Absolute Dates (e.g., "due date 2026 Uh October 10th", "October 10th 2026", "10th October", "Oct 10")
  if (!dueAt) {
    // Pattern 1: [due date] [year?] [filler?] [Month] [Day] [year?]
    // Example: "due date 2026 Uh October 10th", "due date Oct 10th 2026"
    const monthRegexPattern = Object.keys(MONTH_MAP).join("|");
    const absDatePattern1 = new RegExp(
      `\\b(due date|due on|due|deadline|by|on)?\\s*(\\d{4})?\\s*(uh|um)?\\s*(${monthRegexPattern})\\s+(\\d{1,2})(st|nd|rd|th)?(\\s*,?\\s*(\\d{4}))?\\b`,
      "i"
    );

    const match1 = lower.match(absDatePattern1);
    if (match1) {
      dateMatchedStr = match1[0];
      const yearStr = match1[8] || match1[2] || `${now.getFullYear()}`;
      const monthStr = match1[4].toLowerCase();
      const dayStr = match1[5];

      const monthIdx = MONTH_MAP[monthStr];
      const dayNum = parseInt(dayStr, 10);
      const yearNum = parseInt(yearStr, 10);

      if (monthIdx !== undefined && !isNaN(dayNum) && !isNaN(yearNum)) {
        const due = new Date(yearNum, monthIdx, dayNum, 18, 0, 0);
        dueAt = formatDateStr(due);
        summary.push(`Due: ${due.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} 6:00 PM`);
      }
    } else {
      // Pattern 2: [due date] [Day] [of] [Month] [year?]
      // Example: "due date 10th of October 2026", "10 Oct 2026"
      const absDatePattern2 = new RegExp(
        `\\b(due date|due on|due|deadline|by|on)?\\s*(\\d{1,2})(st|nd|rd|th)?\\s+(of\\s+)?(${monthRegexPattern})(\\s*,?\\s*(\\d{4}))?\\b`,
        "i"
      );
      const match2 = lower.match(absDatePattern2);
      if (match2) {
        dateMatchedStr = match2[0];
        const dayStr = match2[2];
        const monthStr = match2[5].toLowerCase();
        const yearStr = match2[7] || `${now.getFullYear()}`;

        const monthIdx = MONTH_MAP[monthStr];
        const dayNum = parseInt(dayStr, 10);
        const yearNum = parseInt(yearStr, 10);

        if (monthIdx !== undefined && !isNaN(dayNum) && !isNaN(yearNum)) {
          const due = new Date(yearNum, monthIdx, dayNum, 18, 0, 0);
          dueAt = formatDateStr(due);
          summary.push(`Due: ${due.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} 6:00 PM`);
        }
      }
    }
  }

  if (dateMatchedStr) {
    phrasesToRemove.push(dateMatchedStr);
  }

  // 4. KPI Bucket Extraction
  let matchedKpiId: string | undefined = undefined;
  for (const k of kpiOptions) {
    if (lower.includes(k.kpiName.toLowerCase())) {
      matchedKpiId = k.id;
      summary.push(`KPI Bucket: ${k.kpiName}`);
      phrasesToRemove.push(k.kpiName.toLowerCase());
      break;
    }
  }

  // 5. Size / Difficulty Extraction
  let sizeLabel: "EASY" | "MEDIUM" | "DIFFICULT" | undefined = undefined;
  if (/\b(easy|quick|small)\b/i.test(lower)) {
    sizeLabel = "EASY";
    summary.push("Size: Easy");
    phrasesToRemove.push("easy", "quick", "small");
  } else if (/\b(difficult|hard|large|complex)\b/i.test(lower)) {
    sizeLabel = "DIFFICULT";
    summary.push("Size: Difficult");
    phrasesToRemove.push("difficult", "hard", "large", "complex");
  } else if (/\b(medium|moderate)\b/i.test(lower)) {
    sizeLabel = "MEDIUM";
    summary.push("Size: Medium");
    phrasesToRemove.push("medium", "moderate");
  }

  // 6. Explicit Description Extraction
  let explicitDescription: string | undefined = undefined;
  const descMatch = text.match(/\b(description|details|note|notes):\s*(.+)$/i);
  if (descMatch) {
    explicitDescription = descMatch[2].trim();
    phrasesToRemove.push(descMatch[0]);
  }

  // 7. Clean Task Title Generation
  let cleanTitle = text;

  // Remove all identified command phrases (assignee, priority, due date, KPI, size)
  for (const phrase of phrasesToRemove) {
    if (!phrase) continue;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const r = new RegExp(escaped, "gi");
    cleanTitle = cleanTitle.replace(r, "");
  }

  // Strip leading action fillers (e.g., "assign task", "create task", "add task", "task")
  cleanTitle = cleanTitle.replace(/^(please\s+)?(assign|create|add)\s+(a\s+)?(new\s+)?task\s*/i, "");
  cleanTitle = cleanTitle.replace(/^(assign|create|add)\s+/i, "");

  // Clean remaining stray words like "due date", "priority", "uh", "um"
  cleanTitle = cleanTitle.replace(/\b(due date|due on|due|deadline|priority|uh|um)\b/gi, "");

  // Clean trailing punctuation and spaces
  cleanTitle = cleanTitle.replace(/\s+/g, " ").replace(/^[,\s:-]+|[,\s:-]+$/g, "").trim();

  // Final fallback if everything was stripped
  if (cleanTitle.length > 0) {
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  } else {
    cleanTitle = text;
  }

  summary.unshift(`Task Title: "${cleanTitle}"`);

  return {
    title: cleanTitle,
    description: explicitDescription,
    assigneeIds: matchedAssignees,
    priority,
    dueAt,
    kpiId: matchedKpiId,
    sizeLabel,
    summary,
  };
}

function formatForDateTimeInput(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : n);
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
