"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Parse the "YYYY-MM-DDTHH:mm" shape (same as a native datetime-local value). */
function parseValue(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(d: Date): string {
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

export default function DateTimePicker({
  name,
  defaultValue,
  required,
  placeholder = "Pick date & time",
  minToday,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  minToday?: boolean;
}) {
  const initial = parseValue(defaultValue ?? "");
  const [value, setValue] = useState<Date | null>(initial);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => initial ?? new Date());
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hour24 = value ? value.getHours() : 9;
  const hour12 = ((hour24 + 11) % 12) + 1;
  const minute = value ? value.getMinutes() : 0;
  const isPM = hour24 >= 12;

  function setDay(d: number) {
    const base = value ? new Date(value) : new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1, 9, 0);
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d, base.getHours(), base.getMinutes());
    setValue(next);
  }

  function setTime(nextHour12: number, nextMinute: number, nextPM: boolean) {
    const base = value ? new Date(value) : new Date(viewMonth.getFullYear(), viewMonth.getMonth(), viewMonth.getDate());
    let h = nextHour12 % 12;
    if (nextPM) h += 12;
    const next = new Date(base);
    next.setHours(h, nextMinute, 0, 0);
    setValue(next);
  }

  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const leadBlanks = firstOfMonth.getDay();
  const cells: (number | null)[] = [...Array(leadBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div ref={wrapRef} className="relative">
      <input type="hidden" name={name} value={value ? toValue(value) : ""} required={required} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-300 px-2.5 py-2 text-left text-sm text-slate-700 hover:border-blue-400"
      >
        <Calendar size={14} className="shrink-0 text-slate-400" />
        <span className={value ? "text-slate-800" : "text-slate-400"}>{value ? fmt(value) : placeholder}</span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setValue(null);
            }}
            className="ml-auto shrink-0 text-slate-300 hover:text-red-500"
          >
            <X size={13} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-slate-700">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-slate-400">
            {WEEKDAYS.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
            {cells.map((d, i) => {
              if (d == null) return <div key={i} />;
              const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
              const isPast = minToday && cellDate < today;
              const isSelected =
                value && value.getDate() === d && value.getMonth() === viewMonth.getMonth() && value.getFullYear() === viewMonth.getFullYear();
              const isToday = cellDate.getTime() === today.getTime();
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!!isPast}
                  onClick={() => setDay(d)}
                  className={cn(
                    "mx-auto grid h-7 w-7 place-items-center rounded-full transition",
                    isSelected
                      ? "bg-blue-600 font-semibold text-white"
                      : isToday
                        ? "border border-blue-300 text-blue-600"
                        : "text-slate-700 hover:bg-blue-50",
                    isPast && "cursor-not-allowed text-slate-300 hover:bg-transparent",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3">
            <Clock size={14} className="shrink-0 text-slate-400" />
            <select
              value={hour12}
              onChange={(e) => setTime(Number(e.target.value), minute, isPM)}
              className="rounded-lg border border-slate-300 px-1.5 py-1 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>{pad(h)}</option>
              ))}
            </select>
            <span className="text-slate-400">:</span>
            <select
              value={minute - (minute % 5)}
              onChange={(e) => setTime(hour12, Number(e.target.value), isPM)}
              className="rounded-lg border border-slate-300 px-1.5 py-1 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                <option key={m} value={m}>{pad(m)}</option>
              ))}
            </select>
            <div className="ml-1 flex overflow-hidden rounded-lg border border-slate-300 text-xs font-medium">
              <button
                type="button"
                onClick={() => setTime(hour12, minute, false)}
                className={cn("px-2 py-1", !isPM ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50")}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => setTime(hour12, minute, true)}
                className={cn("px-2 py-1", isPM ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50")}
              >
                PM
              </button>
            </div>
          </div>

          <div className="mt-3 flex justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => {
                setValue(null);
                setOpen(false);
              }}
              className="text-xs text-slate-400 hover:text-red-500"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
