"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Sparkles, Check, RefreshCw, Volume2 } from "lucide-react";
import { parseVoiceTaskCommand, VoiceParseResult } from "@/lib/voiceTaskParser";

interface VoiceTaskDictatorProps {
  people: { id: string; name: string }[];
  kpiOptions: { id: string; kpiName: string }[];
  onVoiceParsed: (result: VoiceParseResult) => void;
}

export default function VoiceTaskDictator({
  people,
  kpiOptions,
  onVoiceParsed,
}: VoiceTaskDictatorProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const [appliedSummary, setAppliedSummary] = useState<string[] | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  function startListening() {
    setAppliedSummary(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN"; // English (India) / also handles names well

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript("");
        setInterimTranscript("");
      };

      recognition.onresult = (event: any) => {
        let finalStr = "";
        let interimStr = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalStr += event.results[i][0].transcript + " ";
          } else {
            interimStr += event.results[i][0].transcript;
          }
        }

        if (finalStr) {
          setTranscript((prev) => (prev + " " + finalStr).trim());
        }
        setInterimTranscript(interimStr);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Failed to start speech recognition", e);
      setIsListening(false);
    }
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }

  function handleProcessAndApply() {
    const fullText = (transcript + " " + interimTranscript).trim();
    if (!fullText) return;

    if (isListening) {
      stopListening();
    }

    const result = parseVoiceTaskCommand(fullText, people, kpiOptions);
    setAppliedSummary(result.summary);
    onVoiceParsed(result);
  }

  return (
    <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-purple-600 text-white shadow-sm">
            <Mic size={18} className={isListening ? "animate-pulse text-red-300" : ""} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              Assign Task with Voice <Sparkles size={13} className="text-amber-500" />
            </h3>
            <p className="text-[11px] text-slate-500">
              Speak task title, assignee, priority & due date
            </p>
          </div>
        </div>

        {!isListening ? (
          <button
            type="button"
            onClick={startListening}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-purple-700 transition-colors"
          >
            <Mic size={14} /> Start Voice Command
          </button>
        ) : (
          <button
            type="button"
            onClick={stopListening}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-red-700 animate-pulse"
          >
            <Square size={14} /> Stop Listening
          </button>
        )}
      </div>

      {!isSupported && (
        <p className="mt-2 text-[11px] text-amber-600">
          ⚠️ Voice recognition requires Chrome, Edge, or Safari.
        </p>
      )}

      {/* Live transcription box */}
      {(isListening || transcript || interimTranscript) && (
        <div className="mt-2.5 rounded-lg border border-purple-200 bg-white p-2.5 text-xs">
          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Volume2 size={12} className={isListening ? "text-purple-600 animate-bounce" : ""} />
              {isListening ? "Listening..." : "Transcribed Speech"}
            </span>
            <button
              type="button"
              onClick={() => {
                setTranscript("");
                setInterimTranscript("");
                setAppliedSummary(null);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          </div>

          <p className="text-slate-700 italic font-medium">
            {transcript} <span className="text-purple-500 font-normal">{interimTranscript}</span>
            {!transcript && !interimTranscript && isListening && (
              <span className="text-slate-400 font-normal">Listening... speak now</span>
            )}
          </p>

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleProcessAndApply}
              disabled={!transcript && !interimTranscript}
              className="flex items-center gap-1 rounded-md bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              <Sparkles size={12} /> Auto-fill Form from Voice
            </button>
          </div>
        </div>
      )}

      {/* Applied Summary Notification */}
      {appliedSummary && appliedSummary.length > 0 && (
        <div className="mt-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-800">
          <p className="font-semibold flex items-center gap-1 text-[11px] text-emerald-900 mb-1">
            <Check size={14} className="text-emerald-600" /> Auto-filled from Voice Command:
          </p>
          <div className="flex flex-wrap gap-1">
            {appliedSummary.map((item, idx) => (
              <span
                key={idx}
                className="inline-block rounded-md bg-white border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700 shadow-2xs"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Voice Prompt Suggestions */}
      {!isListening && !transcript && (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-500">
          <span className="font-semibold text-slate-600">Try saying:</span>
          <button
            type="button"
            onClick={() => {
              setTranscript("Assign cylinder refilling report to Rahul high priority by tomorrow");
              const res = parseVoiceTaskCommand(
                "Assign cylinder refilling report to Rahul high priority by tomorrow",
                people,
                kpiOptions
              );
              setAppliedSummary(res.summary);
              onVoiceParsed(res);
            }}
            className="hover:underline text-purple-600 cursor-pointer"
          >
            &quot;Assign cylinder refilling report to Rahul high priority by tomorrow&quot;
          </button>
        </div>
      )}
    </div>
  );
}
