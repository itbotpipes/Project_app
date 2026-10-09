import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { transcript, audioBase64, audioMimeType, referenceTime } = body;
    const people = body.people || body.peopleList || [];
    const kpiOptions = body.kpiOptions || body.kpiList || [];

    if (!transcript && !audioBase64) {
      return NextResponse.json({ error: "Transcript or audio recording is required" }, { status: 400 });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY;

    const groqKey = process.env.GROQ_API_KEY;

    if (!apiKey && !groqKey) {
      return NextResponse.json({
        ok: false,
        useClientFallback: true,
        reason: "No AI API key configured in environment",
      });
    }

    // Auto-fetch and merge all active team members from Firestore
    let allPeople = Array.isArray(people) && people.length > 0 ? [...people] : [];
    try {
      const empSnap = await adminDb.collection("Employee").get();
      if (!empSnap.empty) {
        const dbPeople = empSnap.docs
          .filter((d) => d.data().active !== false)
          .map((d) => ({
            id: d.id,
            name: d.data().name || d.data().fullName || d.id,
          }));

        // Merge without duplicates
        const existingIds = new Set(allPeople.map((p) => p.id));
        for (const p of dbPeople) {
          if (!existingIds.has(p.id)) {
            allPeople.push(p);
            existingIds.add(p.id);
          }
        }
      }
    } catch (err) {
      console.warn("Could not query Employee collection:", err);
    }

    const now = referenceTime ? new Date(referenceTime) : new Date();
    const nowIso = now.toISOString();
    const dayOfWeek = now.toLocaleDateString("en-IN", { weekday: "long" });
    const currentDateStr = now.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const peopleListStr = allPeople
      .map((p: any) => `- ID: "${p.id}", Name: "${p.name}"`)
      .join("\n");

    const kpiListStr = (kpiOptions || [])
      .map((k: any) => `- ID: "${k.id}", Name: "${k.kpiName}"`)
      .join("\n");

    const systemPrompt = `You are an intelligent task parsing assistant for an ERP and project management application.
Your goal is to parse raw natural language voice dictation or audio (which may be in English, Hindi, Hinglish, casual speech, or unstructured sentences) into a structured task creation object.

CURRENT REFERENCE TIME:
- ISO: ${nowIso}
- Local Date & Time (India): ${currentDateStr} (${dayOfWeek})

AVAILABLE TEAM MEMBERS (Match by first name, full name, or phonetic resemblance):
${peopleListStr || "None provided"}

AVAILABLE KPI BUCKETS:
${kpiListStr || "None provided"}

PARSING RULES:
1. "title": Clean, professional task title. Remove conversational filler phrases like "Hey please assign", "Sun bol de usko", "I want", "Make sure to", "kal tak". Keep the core action and subject.
2. "description": Any additional details, specific instructions, checklist items mentioned in voice.
3. "assigneeIds": Array of matching employee ID(s) from the team members list above. If name is mentioned (e.g. "Rahul", "Aditya", "Priya"), find the best matching person. If no person matches, return empty array [].
4. "priority": One of:
   - "high": If urgent + important, critical, top priority, emergency.
   - "urgent-only": If urgent, ASAP, jaldi, fast.
   - "important-only": If important, key, vital.
   - "low": If whenever, minor, low priority, time mile to.
   - null if not specified.
5. "dueAt": ISO string in format "YYYY-MM-DDTHH:mm" representing when the task is due.
   - "today" / "aaj" / "by EOD" -> today 18:00
   - "tomorrow" / "kal" -> tomorrow 18:00
   - "in X days" -> current date + X days at 18:00
   - "this Friday" / "next Monday" -> calculate exact date at 18:00
   - If specific time is mentioned (e.g., "by 4 pm", "morning 10 am"), use that exact hour/minute.
   - If no due date mentioned, default to null.
6. "kpiId": The matching KPI bucket ID from AVAILABLE KPI BUCKETS that best fits the work domain (e.g. quotations, safety, store, attendance, billing), or null if none clearly matches.
7. "sizeLabel": Effort estimate: "EASY" (quick <1h), "MEDIUM" (standard 1-3h), "DIFFICULT" (complex/multi-day), or null.
8. "summary": Array of short strings summarizing what was extracted (e.g., ["Assigned to: Rahul Sharma", "Due: Tomorrow 6:00 PM", "Priority: High", "KPI: Quotations"]).

Return ONLY valid JSON matching this schema:
{
  "title": string,
  "description": string,
  "assigneeIds": string[],
  "priority": "high" | "urgent-only" | "important-only" | "low" | null,
  "dueAt": string | null,
  "kpiId": string | null,
  "sizeLabel": "EASY" | "MEDIUM" | "DIFFICULT" | null,
  "summary": string[]
}`;

    let parsedJson: any = null;
    let lastError: any = null;

    // 1. Try Groq (Ultra-fast LLM & Whisper)
    if (groqKey) {
      try {
        let textToParse = transcript || "";

        // If audio is provided, prioritize Groq Whisper for 100% accurate transcription
        if (audioBase64) {
          try {
            const audioBuffer = Buffer.from(audioBase64, "base64");
            const form = new FormData();
            const blob = new Blob([audioBuffer], { type: audioMimeType || "audio/webm" });
            form.append("file", blob, "voice.webm");
            form.append("model", "whisper-large-v3-turbo");

            const namesPrompt = allPeople.map((p: any) => p.name).join(", ");
            if (namesPrompt) {
              form.append("prompt", `Employee names: ${namesPrompt}. Tasks, deadlines, priorities in Hindi and English.`);
            }

            const whisperRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
              method: "POST",
              headers: { Authorization: `Bearer ${groqKey}` },
              body: form,
            });

            if (whisperRes.ok) {
              const wData = await whisperRes.json();
              if (wData.text && wData.text.trim()) {
                textToParse = wData.text.trim();
              }
            } else {
              const wErr = await whisperRes.text();
              console.warn("Groq Whisper API warning:", wErr);
            }
          } catch (wErr) {
            console.warn("Groq Whisper audio error:", wErr);
          }
        }

        if (textToParse) {
          const groqModels = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

          for (const gModel of groqModels) {
            try {
              const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${groqKey}`,
                },
                body: JSON.stringify({
                  model: gModel,
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `VOICE TRANSCRIPT TO PARSE:\n"${textToParse}"` },
                  ],
                  response_format: { type: "json_object" },
                  temperature: 0.1,
                }),
              });

              if (groqRes.ok) {
                const groqData = await groqRes.json();
                const groqContent = groqData.choices?.[0]?.message?.content;
                if (groqContent) {
                  parsedJson = JSON.parse(groqContent);
                  return NextResponse.json({
                    ok: true,
                    data: parsedJson,
                    transcript: textToParse,
                    model: "groq-ai",
                  });
                }
              }
            } catch (err) {
              console.warn(`Groq ${gModel} failed:`, err);
            }
          }
        }
      } catch (e) {
        console.warn("Groq execution failed:", e);
      }
    }

    // 2. Fallback: Try Gemini if available
    if (!parsedJson && apiKey) {
      const parts: any[] = [{ text: systemPrompt }];
      if (audioBase64) {
        parts.push({
          inlineData: {
            mimeType: audioMimeType || "audio/webm",
            data: audioBase64,
          },
        });
        if (transcript) {
          parts.push({ text: `TRANSCRIPTION HINT FROM BROWSER: "${transcript}"` });
        }
      } else {
        parts.push({ text: `VOICE TRANSCRIPT TO PARSE:\n"${transcript}"` });
      }

      const payload = {
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      };

      const models = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
      ];

      for (const model of models) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          );

          if (!res.ok) {
            const errText = await res.text();
            lastError = new Error(`Gemini ${model} API error (${res.status}): ${errText}`);
            continue;
          }

          const data = await res.json();
          const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawContent) {
            parsedJson = JSON.parse(rawContent);
            return NextResponse.json({
              ok: true,
              data: parsedJson,
              model: "gemini",
            });
          }
        } catch (e: any) {
          lastError = e;
        }
      }
    }

    if (!parsedJson) {
      return NextResponse.json({
        ok: false,
        useClientFallback: true,
        error: lastError?.message || "AI service unavailable, using client fallback",
      });
    }

    return NextResponse.json({
      ok: true,
      data: parsedJson,
      model: "ai",
    });
  } catch (error: any) {
    console.error("Voice parse route error:", error);
    return NextResponse.json({
      ok: false,
      useClientFallback: true,
      error: error?.message || "Internal server error",
    });
  }
}
