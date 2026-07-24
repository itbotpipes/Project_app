"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { updateTask } from "@/lib/actions/tasks";
import DateTimePicker from "../../_components/DateTimePicker";

type KpiOpt = { id: string; kpiName: string };

export default function EditTaskDialog({
  taskId,
  title,
  description,
  category,
  sizeLabel,
  dueAt,
  urgent,
  important,
  kpiTemplateId,
  kpiOptions,
}: {
  taskId: string;
  title: string;
  description: string | null;
  category: string | null;
  sizeLabel: string | null;
  dueAt: string | null; // "YYYY-MM-DDTHH:mm" or null
  urgent: boolean;
  important: boolean;
  kpiTemplateId: string | null;
  kpiOptions: KpiOpt[];
}) {
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState<"high" | "important-only" | "urgent-only" | "low">(
    urgent && important ? "high" : important ? "important-only" : urgent ? "urgent-only" : "low",
  );
  const nextUrgent = priority === "high" || priority === "urgent-only";
  const nextImportant = priority === "high" || priority === "important-only";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        <Pencil size={13} /> Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-semibold">Edit task</h2>
            <form
              action={async (fd) => {
                fd.set("taskId", taskId);
                const res = await updateTask(fd);
                if (!res?.error) setOpen(false);
                else window.alert(res.error);
              }}
              className="space-y-3"
            >
              <input
                name="title"
                required
                defaultValue={title}
                placeholder="Task title"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <textarea
                name="description"
                rows={2}
                defaultValue={description ?? ""}
                placeholder="Details (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 text-xs font-medium text-slate-600">
                  KPI bucket
                  <select
                    name="kpiTemplateId"
                    defaultValue={kpiTemplateId ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">— none —</option>
                    {kpiOptions.map((k) => (
                      <option key={k.id} value={k.id}>{k.kpiName}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Priority
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as typeof priority)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="high">High (urgent &amp; important)</option>
                    <option value="important-only">Medium (important)</option>
                    <option value="urgent-only">Medium (urgent)</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <input type="hidden" name="urgent" value={nextUrgent ? "on" : ""} />
                <input type="hidden" name="important" value={nextImportant ? "on" : ""} />
                <label className="text-xs font-medium text-slate-600">
                  Category
                  <input
                    name="category"
                    defaultValue={category ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Size
                  <select name="sizeLabel" defaultValue={sizeLabel ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
                    <option value="">—</option>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="DIFFICULT">Difficult</option>
                  </select>
                </label>
                <label className="col-span-2 text-xs font-medium text-slate-600">
                  Due
                  <div className="mt-1">
                    <DateTimePicker name="dueAt" defaultValue={dueAt ?? ""} />
                  </div>
                </label>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
