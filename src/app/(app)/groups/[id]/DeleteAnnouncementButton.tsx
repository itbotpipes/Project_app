"use client";

import { useState } from "react";
import { deleteGroupAnnouncement } from "@/lib/actions/announcements";

export default function DeleteAnnouncementButton({ annId, groupId }: { annId: string; groupId: string }) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="text-slate-400 hover:text-red-500 text-xs font-semibold transition-colors"
      >
        Delete
      </button>

      {showConfirm && (
        <div 
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">Delete Announcement</h3>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to delete this announcement? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <form 
                action={deleteGroupAnnouncement}
                onSubmit={() => setShowConfirm(false)}
              >
                <input type="hidden" name="id" value={annId} />
                <input type="hidden" name="groupId" value={groupId} />
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
