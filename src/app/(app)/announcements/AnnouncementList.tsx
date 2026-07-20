"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { createAnnouncement, updateAnnouncement, deleteAnnouncement } from "@/lib/actions/announcements";

type Note = { id: string; title: string | null; body: string; author: string | null; createdAt: string };

function Row({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <form
        action={async (fd) => {
          await updateAnnouncement(fd);
          setEditing(false);
        }}
        className="space-y-2 rounded-lg border border-slate-200 p-3"
      >
        <input type="hidden" name="id" value={note.id} />
        <input
          name="title"
          defaultValue={note.title ?? ""}
          placeholder="Title (optional)"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <textarea
          name="body"
          rows={2}
          defaultValue={note.body}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <button className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
      <div className="min-w-0">
        {note.title && <div className="text-sm font-medium">{note.title}</div>}
        <div className="text-sm text-slate-600">{note.body}</div>
        <div className="mt-1 text-[11px] text-slate-400">
          {note.author ? `${note.author} · ` : ""}
          {new Date(note.createdAt).toLocaleDateString()}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <button onClick={() => setEditing(true)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit">
          <Pencil size={15} />
        </button>
        <form action={deleteAnnouncement}>
          <input type="hidden" name="id" value={note.id} />
          <button className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
            <Trash2 size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AnnouncementList({ notes }: { notes: Note[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      {adding ? (
        <form
          action={async (fd) => {
            await createAnnouncement(fd);
            setAdding(false);
          }}
          className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3"
        >
          <input name="title" placeholder="Title (optional)" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <textarea name="body" rows={2} required placeholder="Announcement message…" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700">Post</button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={15} /> New announcement
        </button>
      )}

      {notes.map((n) => <Row key={n.id} note={n} />)}
      {!notes.length && <p className="text-sm text-slate-400">No announcements yet.</p>}
    </div>
  );
}
