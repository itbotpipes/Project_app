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
  sunday: 0, sun: 0, ravivar: 0,
  monday: 1, mon: 1, somvar: 1, somwar: 1,
  tuesday: 2, tue: 2, tues: 2, mangalvar: 2, mangalwar: 2,
  wednesday: 3, wed: 3, budhvar: 3, budhwar: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, guruvar: 4, guruwar: 4, veervar: 4,
  friday: 5, fri: 5, shukravar: 5, shukrawar: 5,
  saturday: 6, sat: 6, shanivar: 6, shaniwar: 6,
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

  // 1. Assignee Extraction (Supports English & Hindi phrases)
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

        // Record assignee phrase for title cleanup (e.g. "to Rahul", "Rahul ko", "Rahul ko bol de", "assigned to Rahul")
        const assignPhraseRegex = new RegExp(
          `\\b(assigned\\s+to|assign\\s+to|to|for|ko\\s+bol\\s+de|ko\\s+dedo|ko\\s+assign|ko)?\\s*(${fullNameLower}|${firstName})\\s*(ko|ko\\s+bol\\s+de|ko\\s+de\\s+do)?\\b`,
          "gi"
        );
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

  // 2. Priority Extraction (English + Hindi/Hinglish)
  let priority: "high" | "important-only" | "urgent-only" | "low" | undefined = undefined;

  const prioRegexes: { pattern: RegExp; val: "high" | "important-only" | "urgent-only" | "low"; label: string }[] = [
    { pattern: /\b(high|critical|top priority|urgent and important|bohot zaroori|bahut zaroori)\s*(priority)?\b/gi, val: "high", label: "Priority: High" },
    { pattern: /\b(urgent|asap|emergency|jaldi|turant)\s*(priority)?\b/gi, val: "urgent-only", label: "Priority: Medium (Urgent)" },
    { pattern: /\b(important|vital|key|zaroori|khas)\s*(priority)?\b/gi, val: "important-only", label: "Priority: Medium (Important)" },
    { pattern: /\b(low|minor|whenever|time mile to|aaram se)\s*(priority)?\b/gi, val: "low", label: "Priority: Low" },
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

  // 3. Due Date Extraction (English & Hindi)
  let dueAt: string | undefined = undefined;
  const now = new Date();

  // Helper date formatter
  const formatDateStr = (d: Date) => formatForDateTimeInput(d);

  let dateMatchedStr: string | null = null;

  if (/\b(today|tonight|by end of day|aaj|aaj shaam|aaj tak)\b/i.test(lower)) {
    const m = lower.match(/\b(due date|due on|due|deadline|by|on|tak)?\s*(today|tonight|by end of day|aaj|aaj shaam|aaj tak)\b/i);
    dateMatchedStr = m ? m[0] : "today";
    const due = new Date(now);
    due.setHours(18, 0, 0, 0);
    dueAt = formatDateStr(due);
    summary.push("Due: Today 6:00 PM");
  } else if (/\b(tomorrow|by tomorrow|kal|kal shaam|kal tak)\b/i.test(lower)) {
    const m = lower.match(/\b(due date|due on|due|deadline|by|on|tak)?\s*(tomorrow|by tomorrow|kal|kal shaam|kal tak)\b/i);
    dateMatchedStr = m ? m[0] : "tomorrow";
    const due = new Date(now);
    due.setDate(due.getDate() + 1);
    due.setHours(18, 0, 0, 0);
    dueAt = formatDateStr(due);
    summary.push("Due: Tomorrow 6:00 PM");
  } else if (/\b(parso|parson|day after tomorrow)\b/i.test(lower)) {
    const m = lower.match(/\b(due date|due on|due|deadline|by|on|tak)?\s*(parso|parson|day after tomorrow)\b/i);
    dateMatchedStr = m ? m[0] : "parso";
    const due = new Date(now);
    due.setDate(due.getDate() + 2);
    due.setHours(18, 0, 0, 0);
    dueAt = formatDateStr(due);
    summary.push("Due: In 2 days (Parso) 6:00 PM");
  } else {
    // Check "in X days" / "X din me"
    const inDaysMatch = lower.match(/\b(due date|due on|due|deadline|by|on)?\s*in (\d+) days?|(\d+) din me\b/i);
    if (inDaysMatch) {
      dateMatchedStr = inDaysMatch[0];
      const days = parseInt(inDaysMatch[2] || inDaysMatch[3], 10);
      const due = new Date(now);
      due.setDate(due.getDate() + days);
      due.setHours(18, 0, 0, 0);
      dueAt = formatDateStr(due);
      summary.push(`Due: In ${days} days`);
    } else {
      // Check Day of Week
      const dayOfWeekMatch = lower.match(
        /\b(due date|due on|due|deadline|by|on|tak)?\s*(this|next|agle)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|somvar|mangalvar|budhvar|guruvar|shukravar|shanivar|ravivar)\b/i
      );
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

  // Absolute Dates
  if (!dueAt) {
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
    }
  }

  if (dateMatchedStr) {
    phrasesToRemove.push(dateMatchedStr);
  }

  // Specific Time extraction (e.g., "at 4pm", "by 10:30 am", "4 baje")
  const timeMatch = lower.match(/\b(at|by|shaam|subah)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)\b/i);
  if (timeMatch && dueAt) {
    let hours = parseInt(timeMatch[2], 10);
    const mins = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const ampm = timeMatch[4].toLowerCase();

    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    if (ampm === "baje" && hours < 8) hours += 12; // e.g. 4 baje -> 4pm

    const baseDate = new Date(dueAt);
    baseDate.setHours(hours, mins, 0, 0);
    dueAt = formatDateStr(baseDate);
    phrasesToRemove.push(timeMatch[0]);
  }

  // 4. KPI Bucket Extraction
  let matchedKpiId: string | undefined = undefined;
  for (const kpi of kpiOptions) {
    const kName = kpi.kpiName.toLowerCase();
    if (lower.includes(kName)) {
      matchedKpiId = kpi.id;
      summary.push(`KPI: ${kpi.kpiName}`);
      phrasesToRemove.push(kName);
      break;
    }
  }

  // Domain Keyword Matching for KPI
  if (!matchedKpiId) {
    const domainKeywords: Record<string, string[]> = {
      quotation: ["quote", "quotation", "pricing", "costing", "proposal"],
      measurement: ["measure", "measurement", "site dimension", "area calculation"],
      payment: ["payment", "collection", "outstanding", "cheque", "dues", "paisa"],
      dispatch: ["dispatch", "loading", "transport", "delivery", "chalaan", "challan"],
      inventory: ["inventory", "stock", "audit", "item count", "godown", "store"],
      safety: ["safety", "ppe", "hazard", "drill", "inspection"],
      billing: ["bill", "invoice", "gst", "tax invoice", "debit note"],
    };

    for (const [key, keywords] of Object.entries(domainKeywords)) {
      const foundKeyword = keywords.find((kw) => lower.includes(kw));
      if (foundKeyword) {
        const matchingKpi = kpiOptions.find((k) => k.kpiName.toLowerCase().includes(key));
        if (matchingKpi) {
          matchedKpiId = matchingKpi.id;
          summary.push(`KPI: ${matchingKpi.kpiName}`);
          break;
        }
      }
    }
  }

  // 5. Effort / Size Extraction
  let sizeLabel: "EASY" | "MEDIUM" | "DIFFICULT" | undefined = undefined;
  if (/\b(easy|quick|small|chhota|5 mins|10 mins|simple)\b/i.test(lower)) {
    sizeLabel = "EASY";
    summary.push("Effort: Easy");
  } else if (/\b(hard|complex|difficult|bada|heavy|major|lengthy)\b/i.test(lower)) {
    sizeLabel = "DIFFICULT";
    summary.push("Effort: Difficult");
  } else if (/\b(medium|standard|normal)\b/i.test(lower)) {
    sizeLabel = "MEDIUM";
  }

  // 6. Title Cleaning & Refinement
  let cleanTitle = text;

  // Common conversational voice starter fillers
  const voiceCommandPrefixes = [
    /^\s*assign\s+task\s+to\s+/i,
    /^\s*assign\s+task\s+/i,
    /^\s*assign\s+this\s+to\s+/i,
    /^\s*assign\s+/i,
    /^\s*create\s+task\s+for\s+/i,
    /^\s*create\s+task\s+/i,
    /^\s*add\s+task\s+/i,
    /^\s*new\s+task\s+/i,
    /^\s*task\s+for\s+/i,
    /^\s*sun\s+bol\s+de\s+/i,
    /^\s*sun\s+/i,
    /^\s*bhai\s+/i,
    /^\s*please\s+/i,
    /^\s*kripya\s+/i,
  ];

  for (const prefix of voiceCommandPrefixes) {
    cleanTitle = cleanTitle.replace(prefix, "");
  }

  // Remove matched keywords/phrases
  for (const phrase of phrasesToRemove) {
    if (!phrase || phrase.length < 2) continue;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleanTitle = cleanTitle.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  }

  // Remove trailing conversational artifacts
  const trailingArtifacts = [
    /\b(due date|due on|due|deadline|by|on|priority|urgent|important|high|low|asap|today|tomorrow|karna hai|karke do|de do|submit karo|bhejo)\b/gi,
  ];
  for (const tRegex of trailingArtifacts) {
    cleanTitle = cleanTitle.replace(tRegex, " ");
  }

  // Normalize whitespace and capitalize first letter
  cleanTitle = cleanTitle.replace(/\s+/g, " ").trim();
  if (cleanTitle.length > 0) {
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  }

  // If title was stripped completely, restore raw text
  if (!cleanTitle || cleanTitle.length < 3) {
    cleanTitle = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return {
    title: cleanTitle,
    description: text !== cleanTitle ? `Voice Dictation: "${text}"` : undefined,
    assigneeIds: matchedAssignees,
    priority,
    dueAt,
    kpiId: matchedKpiId,
    sizeLabel,
    summary,
  };
}

function formatForDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${mins}`;
}
