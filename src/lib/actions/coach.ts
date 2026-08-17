"use server";

import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { mondayOf } from "@/lib/date";
import { computeWeeklyInsights } from "@/lib/insights";

async function gatherContext(userId: string, roleId: string) {
  const weekStart = mondayOf();
  const [weeklyTasksSnap, kpisSnap] = await Promise.all([
    adminDb.collection("Task")
      .where("assigneeId", "==", userId)
      .where("createdAt", ">=", weekStart)
      .get(),
    adminDb.collection("KpiTemplate").where("roleId", "==", roleId).get(),
  ]);

  const kpisMap = new Map(kpisSnap.docs.map(doc => [doc.id, doc.data().kpiName]));

  const tasks = weeklyTasksSnap.docs.map((doc) => {
    const t = doc.data();
    const kpiName = t.kpiTemplateId ? (kpisMap.get(t.kpiTemplateId) ?? null) : null;
    return {
      status: t.status,
      createdAt: t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt),
      completedAt: t.completedAt ? (t.completedAt?.toDate ? t.completedAt.toDate() : new Date(t.completedAt)) : null,
      carryCount: t.carryCount ?? 0,
      kpiName,
    };
  });

  const buckets = kpisSnap.size;
  const insights = computeWeeklyInsights(tasks, buckets);
  return insights;
}

function heuristicReply(message: string, ins: Awaited<ReturnType<typeof gatherContext>>): string {
  const m = message.toLowerCase();
  const s = ins.stats;
  const lead = `This week you created ${s.created} tasks, completed ${s.completed}, and worked ${s.bucketsWorked} KPI area${s.bucketsWorked === 1 ? "" : "s"}${s.topBucket ? ` (mostly "${s.topBucket}")` : ""}.`;

  let advice: string;
  if (/improv|better|suggest|tip|advice|grow|promot/.test(m)) {
    advice = ins.needsAttention.length
      ? `To improve: ${ins.needsAttention.join(" ")}`
      : `You're in good shape — to grow further, start touching 1–2 KPI areas you usually skip, and take on a "difficult" task each week.`;
  } else if (/delay|late|behind|carry|carried|slip/.test(m)) {
    advice = s.carried > 0
      ? `${s.carried} task(s) carried over. Break big tasks into ~30–60 min pieces, set a due time in the morning, and tackle the urgent+important one first.`
      : `Nothing slipped this week — nice. Keep setting a due time on each task so it stays that way.`;
  } else if (/well|good|best|positive|win/.test(m)) {
    advice = ins.wentWell.join(" ");
  } else if (/balance|kpi|bucket/.test(m)) {
    advice = s.bucketsWorked <= 2
      ? `Your effort is concentrated in a few KPIs. Each morning, add at least one task in a different KPI bucket to broaden your profile — that's what unlocks promotion readiness.`
      : `Your KPI spread looks healthy. Keep it balanced and aim for steady completion.`;
  } else {
    advice = `${ins.wentWell[0] ?? ""} ${ins.needsAttention[0] ?? "Keep logging your tasks daily so I can give sharper advice."}`;
  }
  return `${lead}\n\n${advice}`;
}

async function claudeReply(message: string, ins: Awaited<ReturnType<typeof gatherContext>>): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
  const system =
    "You are a supportive, concise work-performance coach inside an internal company app. " +
    "Use ONLY the employee's real weekly stats provided to give specific, encouraging, actionable advice. " +
    "Keep replies under 120 words. Never invent numbers.";
  const facts = JSON.stringify(ins);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: `My weekly stats (JSON): ${facts}\n\nMy question: ${message}` }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.[0]?.text;
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

export async function askCoach(_prev: unknown, formData: FormData): Promise<{ reply: string }> {
  const user = await getCurrentUser();
  if (!user) return { reply: "Please sign in." };
  const message = String(formData.get("message") || "").trim();
  if (!message) return { reply: "Ask me anything about your week — what went well, what to improve, or how to grow." };

  const ins = await gatherContext(user.id, user.roleId);
  const viaClaude = await claudeReply(message, ins);
  return { reply: viaClaude ?? heuristicReply(message, ins) };
}
