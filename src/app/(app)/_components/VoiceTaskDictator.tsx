"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Sparkles, Check, Volume2, Loader2, AlertCircle } from "lucide-react";
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
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [recordDuration, setRecordDuration] = useState<number>(0);
  const [isSupported, setIsSupported] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [parsedSource, setParsedSource] = useState<"gemini" | "groq-llama-3.3" | "client" | null>(null);
  const [appliedSummary, setAppliedSummary] = useState<string[] | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const accumulatedTextRef = useRef<string>("");

  useEffect(() => {
    const hasMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    const hasSpeech = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    setIsSupported(hasMedia || hasSpeech);

    return () => {
      stopRecordingCleanup();
    };
  }, []);

  function stopRecordingCleanup() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    setAudioLevel(0);
  }

  function createAndStartSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatusMessage("Audio recording active.");
      return null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN";
      recognition.maxAlternatives = 1;

      let sessionFinal = "";

      recognition.onstart = () => {
        setStatusMessage("Listening... Speak now");
      };

      recognition.onspeechstart = () => {
        setStatusMessage("Speech detected ✓");
      };

      recognition.onresult = (event: any) => {
        let currentSessionFinal = "";
        let interim = "";

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item && item[0]) {
            if (item.isFinal) {
              currentSessionFinal += item[0].transcript + " ";
            } else {
              interim += item[0].transcript;
            }
          }
        }

        sessionFinal = currentSessionFinal;
        const combined = (accumulatedTextRef.current + " " + sessionFinal).trim();
        if (combined) {
          setTranscript(combined);
        }
        setInterimTranscript(interim.trim());
      };

      let hasFatalError = false;

      recognition.onerror = (event: any) => {
        console.warn("[VoiceDictation] Speech recognition event error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "aborted") {
          hasFatalError = true;
          if (event.error !== "aborted") {
            setStatusMessage("Microphone permission denied. Please allow mic in browser settings.");
          }
        } else if (event.error === "no-speech") {
          setStatusMessage("Listening... Speak now");
        } else if (event.error === "network") {
          hasFatalError = true;
          setStatusMessage("Audio recording active.");
        }
      };

      recognition.onend = () => {
        accumulatedTextRef.current = (accumulatedTextRef.current + " " + sessionFinal).trim();
        sessionFinal = "";

        if (isListeningRef.current && !hasFatalError) {
          restartTimerRef.current = setTimeout(() => {
            if (isListeningRef.current) {
              try {
                recognitionRef.current = createAndStartSpeechRecognition();
              } catch {}
            }
          }, 200);
        }
      };

      recognition.start();
      return recognition;
    } catch (err) {
      console.warn("[VoiceDictation] Speech recognition init error:", err);
      return null;
    }
  }

  async function startListening() {
    stopRecordingCleanup();
    setTranscript("");
    setInterimTranscript("");
    setAppliedSummary(null);
    setParsedSource(null);
    setStatusMessage("Listening... Speak now");
    accumulatedTextRef.current = "";
    audioBlobRef.current = null;
    audioChunksRef.current = [];
    setRecordDuration(0);
    isListeningRef.current = true;
    setIsListening(true);

    // Duration timer
    timerRef.current = setInterval(() => {
      setRecordDuration((prev) => prev + 1);
    }, 1000);

    // 1. Web Speech Recognition for live preview
    recognitionRef.current = createAndStartSpeechRecognition();

    // 2. Microphone Audio Capture for Groq Whisper
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          if (!isListeningRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;

          // Audio visualizer analyser
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              const ctx = new AudioContextClass();
              audioContextRef.current = ctx;
              if (ctx.state === "suspended") {
                ctx.resume().catch(() => {});
              }
              const source = ctx.createMediaStreamSource(stream);
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 64;
              analyser.smoothingTimeConstant = 0.5;
              source.connect(analyser);

              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              const updateVolume = () => {
                if (!isListeningRef.current) return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                setAudioLevel(Math.min(100, Math.round(avg * 2.2)));
                animFrameRef.current = requestAnimationFrame(updateVolume);
              };
              updateVolume();
            }
          } catch (e) {
            console.warn("[VoiceDictation] AudioContext not available:", e);
          }

          // MediaRecorder for Groq Whisper audio
          try {
            let mimeType = "audio/webm;codecs=opus";
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              if (MediaRecorder.isTypeSupported("audio/webm")) {
                mimeType = "audio/webm";
              } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
                mimeType = "audio/mp4";
              } else {
                mimeType = "";
              }
            }

            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) {
                audioChunksRef.current.push(event.data);
              }
            };

            recorder.onstop = () => {
              if (audioChunksRef.current.length > 0) {
                const recordedType = mimeType || audioChunksRef.current[0].type || "audio/webm";
                const blob = new Blob(audioChunksRef.current, { type: recordedType });
                audioBlobRef.current = blob;
              }
            };

            recorder.start(250);
          } catch (recErr) {
            console.warn("[VoiceDictation] MediaRecorder start error:", recErr);
          }
        })
        .catch((err) => {
          console.warn("[VoiceDictation] getUserMedia error:", err);
          setStatusMessage("Microphone access denied. Please allow microphone permission in your browser.");
        });
    }
  }

  function stopListening() {
    isListeningRef.current = false;
    setIsListening(false);

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    stopRecordingCleanup();
  }

  async function handleProcessAndApply(customText?: string) {
    if (isListening) {
      stopListening();
    }

    // Wait 250ms for MediaRecorder to finalize blob chunks
    await new Promise((r) => setTimeout(r, 250));

    const fullText = (typeof customText === "string" ? customText : transcript + " " + interimTranscript).trim();

    setIsParsingAi(true);
    setStatusMessage("Transcribing & parsing with AI...");

    try {
      let audioBase64: string | null = null;
      let audioMimeType: string | null = null;

      if (audioBlobRef.current) {
        audioBase64 = await convertBlobToBase64(audioBlobRef.current);
        audioMimeType = audioBlobRef.current.type;
      }

      if (!fullText && !audioBase64) {
        setStatusMessage("No speech or audio recorded. Please speak or type in the box.");
        setIsParsingAi(false);
        return;
      }

      // Call AI server route
      const res = await fetch("/api/ai/parse-voice-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: fullText || "",
          audioBase64,
          audioMimeType,
          peopleList: people.map((p) => ({ id: p.id, name: p.name })),
          kpiList: kpiOptions.map((k) => ({ id: k.id, kpiName: k.kpiName })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const parsed = data.data;

          if (parsed.transcribedText && !fullText) {
            setTranscript(parsed.transcribedText);
          }

          const result: VoiceParseResult = {
            title: parsed.title,
            description: parsed.description,
            assigneeIds: parsed.assigneeIds || [],
            priority: parsed.priority || "MEDIUM",
            dueAt: parsed.dueAt || undefined,
            kpiId: parsed.kpiId || undefined,
            summary: parsed.summary || [],
            confidence: parsed.confidence || 0.9,
          };

          setParsedSource(data.source || "groq-llama-3.3");
          setAppliedSummary(result.summary);
          onVoiceParsed(result);
          setStatusMessage("✓ Task details auto-filled successfully!");
          setIsParsingAi(false);
          return;
        }
      }
    } catch (err) {
      console.warn("[VoiceDictation] AI endpoint failed, falling back to local parser:", err);
    } finally {
      setIsParsingAi(false);
    }

    // Fallback to Local Client-side Parser
    if (fullText) {
      const fallbackResult = parseVoiceTaskCommand(fullText, people, kpiOptions);
      setParsedSource("client");
      setAppliedSummary(fallbackResult.summary);
      onVoiceParsed(fallbackResult);
    }
  }

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-blue-50/60 p-3 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`relative grid h-8 w-8 place-items-center rounded-lg ${
              isListening ? "bg-red-500 animate-pulse text-white" : "bg-purple-600 text-white"
            } shadow-xs transition-colors`}
          >
            <Mic size={16} />
            {isListening && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-400 animate-ping" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
              Voice Task Auto-Fill <Sparkles size={12} className="text-purple-600" />
            </h4>
            <p className="text-[11px] text-slate-500">
              Speak task details to auto-assign &amp; fill form
            </p>
          </div>
        </div>

        {isListening && (
          <div className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span>{formatSeconds(recordDuration)}</span>
          </div>
        )}
      </div>

      {!isSupported && (
        <p className="mt-2 text-[11px] text-amber-600 flex items-center gap-1">
          <AlertCircle size={12} /> Microphone requires browser permissions.
        </p>
      )}

      {/* When Listening: Visualizer & Live Preview */}
      {isListening ? (
        <div className="mt-2.5 space-y-2 rounded-lg border border-purple-200 bg-white p-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            {/* Audio waveform */}
            <div className="flex flex-1 items-center gap-1 h-5">
              {[25, 50, 75, 40, 90, 60, 35, 70, 55, 80, 45, 65].map((h, i) => (
                <span
                  key={i}
                  className="w-1 bg-purple-600 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(4, Math.min(18, (audioLevel / 100) * h))}px`,
                    opacity: audioLevel > 10 ? 1 : 0.4,
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleProcessAndApply()}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
            >
              <Check size={14} /> Done &amp; Apply
            </button>
          </div>

          <div className="rounded-md bg-purple-50/60 p-2 text-xs text-slate-700 border border-purple-100 min-h-[36px]">
            {transcript || interimTranscript ? (
              <span>
                {transcript} <span className="text-purple-500 italic">{interimTranscript}</span>
              </span>
            ) : (
              <span className="text-slate-400 italic">
                {audioLevel > 5
                  ? "Audio receiving... Speak now"
                  : 'Listening... (e.g. "Assign safety inspection to Aditya high priority by tomorrow 4 PM")'}
              </span>
            )}
          </div>
        </div>
      ) : !transcript ? (
        /* When Idle: Clean Speak Button */
        <button
          type="button"
          onClick={startListening}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-700 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
        >
          <Mic size={14} /> Click to Speak Task
        </button>
      ) : null}

      {/* When Stopped & Text Exists: Editable Box */}
      {!isListening && (transcript || interimTranscript) && (
        <div className="mt-2.5 space-y-2 rounded-lg border border-purple-200 bg-white p-2.5 text-xs shadow-xs">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="font-medium text-slate-600 flex items-center gap-1">
              <Volume2 size={12} className="text-purple-600" /> Recognized Voice Command:
            </span>
            <button
              type="button"
              onClick={() => {
                setTranscript("");
                setInterimTranscript("");
                setAppliedSummary(null);
                setParsedSource(null);
                audioBlobRef.current = null;
              }}
              className="text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
            >
              Clear
            </button>
          </div>

          <textarea
            rows={2}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Type or edit voice command here..."
            className="w-full rounded-md border border-slate-200 p-2 text-xs font-medium text-slate-800 focus:border-purple-500 focus:outline-none bg-slate-50/50"
          />

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={startListening}
              className="flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
            >
              <Mic size={12} /> Speak Again
            </button>

            <button
              type="button"
              onClick={() => handleProcessAndApply()}
              disabled={!transcript.trim() || isParsingAi}
              className="flex items-center gap-1.5 rounded-md bg-purple-600 hover:bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
            >
              {isParsingAi ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles size={12} /> Auto-fill Form
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Applied Summary Notification */}
      {appliedSummary && appliedSummary.length > 0 && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2 text-xs text-emerald-800">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold flex items-center gap-1 text-[11px] text-emerald-900">
              <Check size={13} className="text-emerald-600" /> Auto-filled from Voice:
            </p>
            {parsedSource && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700">
                <Sparkles size={9} /> {parsedSource === "gemini" ? "AI Parsed" : parsedSource === "groq-llama-3.3" ? "Groq AI" : "Smart Parser"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {appliedSummary.map((item, idx) => (
              <span
                key={idx}
                className="inline-block rounded bg-white border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function convertBlobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const base64 = base64data.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
