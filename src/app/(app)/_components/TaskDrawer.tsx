"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

export default function TaskDrawer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestClose() {
    setShow(false);
    setTimeout(onClose, 180);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"}`}
        onClick={requestClose}
      />
      <div
        className={`relative flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl transition-transform duration-200 ease-out ${
          show ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close task details"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-sm font-semibold text-slate-700">Task Details</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
