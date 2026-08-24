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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function send(file: File, kind: string) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("kind", kind);
    fd.set("file", file);
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => ev.data.size && chunksRef.current.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await send(new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" }), "VOICE");
        setRecording(false);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Microphone permission denied.");
    }
  }
  function stopRec() {
    recorderRef.current?.stop();
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
        {busy && <Loader2 size={16} className="animate-spin text-slate-400" />}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
