"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createTask } from "@/lib/actions/tasks";
import BucketFill from "../_components/BucketFill";

type KpiOpt = { id: string; kpiName: string; kraName: string };
type Person = { id: string; name: string };

export default function NewTaskDialog({
  kpiOptions,
  people,
  selfId,
  todaysCounts,
}: {
  kpiOptions: KpiOpt[];
  people: Person[];
  selfId: string;
  todaysCounts: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState("");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus size={16} /> New task
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="mb-3 text-lg font-semibold">New task</h2>
            <form
              action={async (fd) => {
                await createTask(fd);
                setOpen(false);
              }}
              className="space-y-3"
            >
              <input
                name="title"
                required
                placeholder="Task title"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <textarea
                name="description"
                rows={2}
                placeholder="Details (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 text-xs font-medium text-slate-600">
                  KPI bucket
                  <select
                    name="kpiTemplateId"
                    value={selectedKpi}
                    onChange={(e) => setSelectedKpi(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">— none —</option>
                    {kpiOptions.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.kpiName}
                      </option>
                    ))}
                  </select>
                </label>
                {kpiOptions.length > 0 && (
                  <div className="col-span-2 -mt-1 rounded-lg bg-slate-50 p-3">
                    <p className="mb-2 text-[11px] text-slate-500">
                      Today&apos;s buckets — see where this task will land:
                    </p>
                    <BucketFill
                      size="sm"
                      highlightId={selectedKpi}
                      buckets={kpiOptions.map((k) => ({ id: k.id, name: k.kpiName, count: todaysCounts[k.id] ?? 0 }))}
                    />
                  </div>
                )}
                <label className="text-xs font-medium text-slate-600">
                  Assign to
                  <select
                    name="assigneeId"
                    defaultValue={selfId}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Size
                  <select
                    name="sizeLabel"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">—</option>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="DIFFICULT">Difficult</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Est. minutes
                  <input
                    name="estimatedMins"
                    type="number"
                    min="0"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="col-span-2 text-xs font-medium text-slate-600">
                  Due
                  <input
                    name="dueAt"
                    type="datetime-local"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="urgent" /> Urgent
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="important" /> Important
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="reviewRequired" /> Needs manager review
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
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Create task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
