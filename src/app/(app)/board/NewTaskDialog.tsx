"use client";

import { useState, useRef } from "react";
import { Plus, ListChecks, X, FileStack, Search, Check, Paperclip, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { createTask } from "@/lib/actions/tasks";
import BucketFill from "../_components/BucketFill";
import DateTimePicker from "../_components/DateTimePicker";
import VoiceTaskDictator from "../_components/VoiceTaskDictator";
import { VoiceParseResult } from "@/lib/voiceTaskParser";

type KpiOpt = { id: string; kpiName: string; kraName: string; roleId?: string };
type Person = { id: string; name: string; roleId?: string };
export type TemplateOpt = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  category: string | null;
  kpiTemplateId: string | null;
  sizeLabel: string | null;
  roleId: string | null;
  isPersonal?: boolean;
  createdById?: string;
  checklist: string[];
};

export default function NewTaskDialog({
  kpiOptions,
  people,
  selfId,
  todaysCounts,
  groupId,
  buttonLabel,
  templates,
}: {
  kpiOptions: KpiOpt[];
  people: Person[];
  selfId: string;
  todaysCounts: Record<string, number>;
  groupId?: string;
  buttonLabel?: string;
  templates?: TemplateOpt[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedKpi, setSelectedKpi] = useState("");
  const [sizeLabel, setSizeLabel] = useState("");
  const [category, setCategory] = useState("");
  const [concernedContact, setConcernedContact] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([selfId]);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [priority, setPriority] = useState<"high" | "important-only" | "urgent-only" | "low">("low");
  const [dueAt, setDueAt] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const urgent = priority === "high" || priority === "urgent-only";
  const important = priority === "high" || priority === "important-only";

  const [showChecklist, setShowChecklist] = useState(false);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState("");

  const [showLoop, setShowLoop] = useState(false);
  const [watcherIds, setWatcherIds] = useState<string[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameById = new Map(people.map((p) => [p.id, p.name]));

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setAttachedFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachedFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleVoiceParsed(result: VoiceParseResult) {
    if (result.title) setTitle(result.title);
    if (result.description !== undefined) {
      setDescription(result.description);
    }
    if (result.assigneeIds && result.assigneeIds.length > 0) {
      setAssigneeIds(result.assigneeIds);
    }
    if (result.priority) setPriority(result.priority);
    if (result.kpiId) setSelectedKpi(result.kpiId);
    if (result.sizeLabel) setSizeLabel(result.sizeLabel);
    if (result.dueAt) setDueAt(result.dueAt);
  }

  const firstAssignee = people.find((p) => assigneeIds.includes(p.id));
  const firstAssigneeRoleId = firstAssignee?.roleId || people.find((p) => p.id === selfId)?.roleId;
  const rawFilteredKpiOptions = firstAssigneeRoleId
    ? kpiOptions.filter((k) => k.roleId === firstAssigneeRoleId)
    : kpiOptions;

  // Deduplicate by KPI name (case-insensitive) so no KPI is ever shown double
  const seenKpi = new Set<string>();
  const filteredKpiOptions: KpiOpt[] = [];
  for (const k of rawFilteredKpiOptions) {
    const key = k.kpiName.trim().toLowerCase();
    if (!seenKpi.has(key)) {
      seenKpi.add(key);
      filteredKpiOptions.push(k);
    }
  }
  
  // Everyone sees their own created templates + position/general templates
  const myTemplates = (templates ?? []).filter((t) => t.createdById === selfId);
  const sharedTemplates = (templates ?? []).filter(
    (t) => t.createdById !== selfId && (!t.roleId || t.roleId === firstAssigneeRoleId)
  );
  const templatesForAssignee = [...myTemplates, ...sharedTemplates];

  const filteredPeople = people.filter((p) =>
    p.name.toLowerCase().includes(assigneeSearch.toLowerCase())
  );

  function applyTemplate(templateId: string) {
    const t = (templates ?? []).find((x) => x.id === templateId);
    if (!t) return;
    setTitle(t.title);
    setDescription(t.description ?? "");
    setSelectedKpi(t.kpiTemplateId ?? "");
    setSizeLabel(t.sizeLabel ?? "");
    setCategory(t.category ?? "");
    if (t.checklist.length) {
      setChecklist(t.checklist);
      setShowChecklist(true);
    }
  }

  function addChecklistDraft() {
    const t = checklistDraft.trim();
    if (!t) return;
    setChecklist((c) => [...c, t]);
    setChecklistDraft("");
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setSelectedKpi("");
    setSizeLabel("");
    setCategory("");
    setConcernedContact("");
    setAssigneeIds([selfId]);
    setAssigneeSearch("");
    setPriority("low");
    setDueAt("");
    setShowChecklist(false);
    setChecklist([]);
    setChecklistDraft("");
    setShowLoop(false);
    setWatcherIds([]);
    setSaveAsTemplate(false);
    setSaveTemplateName("");
    setAttachedFiles([]);
    setIsSubmitting(false);
    setErrorMsg(null);
  }

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id]
    );
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus size={16} /> {buttonLabel ?? "Assign New Task"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Assign New Task</h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Cancel and close"
              >
                <X size={18} />
              </button>
            </div>
            <form
              action={async (fd) => {
                const dueRaw = String(fd.get("dueAt") || "");
                const estMins = Number(fd.get("estimatedMins") || 0);
                
                if (dueRaw) {
                  const dueAtDate = new Date(dueRaw);
                  const now = new Date();
                  
                  if (dueAtDate < now) {
                    setErrorMsg("Deadline cannot be set before the current time.");
                    return;
                  }
                  
                  if (estMins > 0) {
                    const minDue = new Date(now.getTime() + estMins * 60 * 1000);
                    if (dueAtDate < minDue) {
                      setErrorMsg(`Deadline must be at least ${estMins} minutes in the future (current time + estimated time).`);
                      return;
                    }
                  }
                }
                
                setErrorMsg(null);
                setIsSubmitting(true);
                if (groupId) fd.set("groupId", groupId);
                attachedFiles.forEach((file) => {
                  fd.append("attachments", file);
                });
                try {
                  const res = await createTask(fd);
                  if (res?.error) {
                    setErrorMsg(res.error);
                  } else {
                    setOpen(false);
                    resetForm();
                  }
                } catch (err: any) {
                  setErrorMsg(err?.message || "Failed to create task");
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-3"
            >
              {/* Voice Task Command Dictation */}
              <VoiceTaskDictator
                people={people}
                kpiOptions={kpiOptions}
                onVoiceParsed={handleVoiceParsed}
              />

              {templates && templates.length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 text-xs font-medium text-blue-900 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold">
                      <FileStack size={14} className="text-blue-600" /> Start from a template
                    </span>
                    <a
                      href="/templates"
                      target="_blank"
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      Manage templates ↗
                    </a>
                  </div>
                  <select
                    onChange={(e) => e.target.value && applyTemplate(e.target.value)}
                    defaultValue=""
                    className="w-full rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-hidden"
                  >
                    <option value="">— write it myself —</option>
                    {myTemplates.length > 0 && (
                      <optgroup label="⭐ My Personal Templates">
                        {myTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {sharedTemplates.length > 0 && (
                      <optgroup label="📋 Role & Shared Templates">
                        {sharedTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              <input
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <textarea
                name="description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />

              {/* Attach Files (Multiple files upload option) */}
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Paperclip size={14} className="text-blue-600" /> Attach Files
                    <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                      (Images, PDFs, Docs, Sheets)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                  >
                    <Plus size={13} /> Add files
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                    onChange={handleFilesSelected}
                    className="hidden"
                  />
                </div>

                {attachedFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {attachedFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {f.type.startsWith("image/") ? (
                            <ImageIcon size={14} className="text-purple-600 shrink-0" />
                          ) : (
                            <FileText size={14} className="text-blue-600 shrink-0" />
                          )}
                          <span className="truncate font-medium">{f.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            ({formatBytes(f.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachedFile(idx)}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded"
                          title="Remove file"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* + Add Checklist */}
              <div className="rounded-lg border border-slate-200 p-2.5">
                <button
                  type="button"
                  onClick={() => setShowChecklist((s) => !s)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600"
                >
                  <ListChecks size={14} /> {showChecklist ? "Hide checklist" : "+ Add Checklist"}
                  {checklist.length > 0 && !showChecklist && (
                    <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500">{checklist.length}</span>
                  )}
                </button>
                {showChecklist && (
                  <div className="mt-2 space-y-1.5">
                    {checklist.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="hidden" name="checklist" value={item} />
                        <span className="flex-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">☐ {item}</span>
                        <button
                          type="button"
                          onClick={() => setChecklist((c) => c.filter((_, idx) => idx !== i))}
                          className="text-slate-300 hover:text-red-500"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <input
                        value={checklistDraft}
                        onChange={(e) => setChecklistDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addChecklistDraft();
                          }
                        }}
                        placeholder="Checklist item — press Enter to add"
                        className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={addChecklistDraft}
                        className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                      >
                        Add
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Add as many as you need — all must be ticked before this task can be Closed.
                    </p>
                  </div>
                )}
              </div>

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
                    {filteredKpiOptions.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.kpiName}
                      </option>
                    ))}
                  </select>
                </label>
                {filteredKpiOptions.length > 0 && (
                  <div className="col-span-2 -mt-1 rounded-lg bg-slate-50 p-3">
                    <p className="mb-2 text-[11px] text-slate-500">
                      Today&apos;s buckets — see where this task will land:
                    </p>
                    <BucketFill
                      size="sm"
                      highlightId={selectedKpi}
                      buckets={filteredKpiOptions.map((k) => ({ id: k.id, name: k.kpiName, count: todaysCounts[k.id] ?? 0 }))}
                    />
                  </div>
                )}

                {/* Multi-Select Assignee Section with Search Bar */}
                <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Assign to <span className="font-normal text-slate-500">(Multi-select enabled)</span>
                    </label>
                    <span className="text-[11px] font-semibold text-blue-600">
                      {assigneeIds.length} person{assigneeIds.length === 1 ? "" : "s"} selected
                    </span>
                  </div>

                  {/* Form hidden inputs */}
                  {assigneeIds.map((id) => (
                    <input key={id} type="hidden" name="assigneeIds" value={id} />
                  ))}
                  <input type="hidden" name="assigneeId" value={assigneeIds[0] || selfId} />

                  {/* Selected Assignees Chips */}
                  {assigneeIds.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1.5 bg-white rounded-lg border border-slate-200">
                      {assigneeIds.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {nameById.get(id) || "Assignee"}
                          {assigneeIds.length > 1 && (
                            <button
                              type="button"
                              onClick={() => toggleAssignee(id)}
                              className="text-blue-500 hover:text-red-500 ml-0.5"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Member Search Bar */}
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      placeholder="Search member..."
                      className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-7 py-1.5 text-xs outline-none focus:border-blue-500"
                    />
                    {assigneeSearch && (
                      <button
                        type="button"
                        onClick={() => setAssigneeSearch("")}
                        className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Scrollable Members List */}
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                    {groupId && (
                      <button
                        type="button"
                        onClick={() => setAssigneeIds(people.map((p) => p.id))}
                        className="flex items-center justify-between w-full px-3 py-1.5 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        <span>Select Whole Group Team ({people.length} people)</span>
                        {assigneeIds.length === people.length && <Check size={14} className="text-blue-600" />}
                      </button>
                    )}
                    {filteredPeople.map((p) => {
                      const isSelected = assigneeIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleAssignee(p.id)}
                          className={
                            isSelected
                              ? "flex items-center justify-between w-full px-3 py-1.5 text-left text-xs font-medium text-blue-700 bg-blue-50/80"
                              : "flex items-center justify-between w-full px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50"
                          }
                        >
                          <span>{p.name}</span>
                          <span className={isSelected ? "text-blue-600 font-bold" : "text-slate-300"}>
                            {isSelected ? "✓" : "○"}
                          </span>
                        </button>
                      );
                    })}
                    {filteredPeople.length === 0 && (
                      <p className="px-3 py-2 text-center text-xs text-slate-400">
                        No members matching &quot;{assigneeSearch}&quot;
                      </p>
                    )}
                  </div>
                </div>

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
                <label className="text-xs font-medium text-slate-600">
                  Category
                  <input
                    name="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Client Follow-up"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="col-span-2 text-xs font-medium text-slate-600">
                  Concerned Contact
                  <input
                    name="concernedContact"
                    value={concernedContact}
                    onChange={(e) => setConcernedContact(e.target.value)}
                    placeholder="e.g. Client name, vendor, phone number or email"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </label>
                <input type="hidden" name="urgent" value={urgent ? "on" : ""} />
                <input type="hidden" name="important" value={important ? "on" : ""} />
                <label className="text-xs font-medium text-slate-600">
                  Size
                  <select
                    name="sizeLabel"
                    value={sizeLabel}
                    onChange={(e) => setSizeLabel(e.target.value)}
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
                  <div className="mt-1">
                    <DateTimePicker name="dueAt" value={dueAt} minToday />
                  </div>
                </label>
              </div>

              {/* In Loop — watchers */}
              <div>
                {watcherIds.map((id) => (
                  <input key={id} type="hidden" name="watcherIds" value={id} />
                ))}
                <button
                  type="button"
                  onClick={() => setShowLoop((s) => !s)}
                  className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  👥 In Loop {watcherIds.length > 0 && `(${watcherIds.length})`}
                </button>
                {watcherIds.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {watcherIds.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {nameById.get(id)}
                        <button type="button" onClick={() => setWatcherIds((w) => w.filter((x) => x !== id))} className="text-slate-400 hover:text-red-500">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[10px] text-slate-400">
                  Anyone marked In Loop gets a pop-up notification and sees this in Subscribed Tasks.
                </p>
                {showLoop && (
                  <div className="mt-1.5 max-h-28 overflow-y-auto rounded-lg border border-slate-200 p-1">
                    {people.filter((p) => p.id !== selfId).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setWatcherIds((w) => (w.includes(p.id) ? w : [...w, p.id]))}
                        className="block w-full rounded px-2 py-1 text-left text-sm text-slate-600 hover:bg-blue-50"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="reviewRequired" /> Needs manager review
                </label>
              </div>

              {/* Save as personal template option */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="saveAsTemplate"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Save this task as my personal template</span>
                </label>
                {saveAsTemplate && (
                  <div className="pt-1">
                    <input
                      name="saveTemplateName"
                      value={saveTemplateName}
                      onChange={(e) => setSaveTemplateName(e.target.value)}
                      placeholder={title ? `Template name (e.g. ${title})` : "Enter template name"}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Saved to your personal templates so you can reuse this task and its checklist anytime.
                    </p>
                  </div>
                )}
              </div>
              {errorMsg && (
                <div className="mt-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg p-2.5">
                  ⚠️ {errorMsg}
                </div>
              )}
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
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Assigning &amp; Uploading...</span>
                    </>
                  ) : (
                    <>🚀 Assign Task</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
