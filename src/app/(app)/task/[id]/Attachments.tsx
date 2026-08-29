"use client";

import { useRef, useState } from "react";
import { Paperclip, Mic, Square, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { uploadTaskAttachment } from "@/lib/actions/attachments";
import { useTaskDrawer } from "../../_components/TaskDrawerContext";

export default function Attachments({ taskId }: { taskId: string }) {
  const router = useRouter();
  const ctx = useTaskDrawer();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");

  async function send(file: File, kind: string, voiceTranscript?: string) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("kind", kind);
    fd.set("file", file);
    if (voiceTranscript) {
      fd.set("transcript", voiceTranscript);
    }
    const res = await uploadTaskAttachment(fd);
    setBusy(false);
    if (res?.error) setError(res.error);
    else if (res?.attachment && ctx?.setTaskData) {
      ctx.setTaskData((prev) =>
        prev
          ? {
              ...prev,
              attachments: [res.attachment, ...prev.attachments],
            }
          : null
      );
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) await send(f, "FILE");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function startRec() {
    setError(null);
    setTranscript("");
    transcriptRef.current = "";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => ev.data.size && chunksRef.current.push(ev.data);
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-IN"; // Tailored for India, fallback is en-US
        
        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + " ";
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const currentText = (finalTranscript + interimTranscript).trim();
          setTranscript(currentText);
          transcriptRef.current = currentText;
        };
        
        recognition.onerror = (err: any) => {
          console.error("Speech recognition error:", err);
        };
        
        recognitionRef.current = recognition;
        recognition.start();
      }

      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const finalTrans = transcriptRef.current;
        await send(
          new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" }),
          "VOICE",
          finalTrans
        );
        setRecording(false);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (err) {
      console.error(err);
      setError("Microphone permission denied.");
    }
  }
  function stopRec() {
    recorderRef.current?.stop();
    try {
      recognitionRef.current?.stop();
    } catch (e) {}
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          <Paperclip size={15} /> Attach file
        </button>
        <input ref={fileRef} type="file" onChange={onFile} className="hidden" />

        {!recording ? (
          <button
            type="button"
            onClick={startRec}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            <Mic size={15} /> Record voice note
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRec}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            <Square size={14} /> Stop &amp; save
            <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
