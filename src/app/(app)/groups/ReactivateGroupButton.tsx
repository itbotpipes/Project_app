"use client";

import { useState } from "react";
import { activateGroup } from "@/lib/actions/groups";

export default function ReactivateGroupButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
      >
        Reactivate
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
            <h3 className="text-lg font-semibold text-slate-900">Reactivate Group</h3>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to reactivate the group "{groupName}"? It will become visible to members again.
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
                action={activateGroup}
                onSubmit={() => setShowConfirm(false)}
              >
                <input type="hidden" name="groupId" value={groupId} />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                >
                  Confirm Reactivate
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
