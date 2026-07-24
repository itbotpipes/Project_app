"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { addGroupMember, removeGroupMember } from "@/lib/actions/groups";

type Member = { id: string; name: string; role: string };
type Person = { id: string; name: string };

export default function GroupMembers({
  groupId,
  members,
  allPeople,
  canManage,
}: {
  groupId: string;
  members: Member[];
  allPeople: Person[];
  canManage: boolean;
}) {
  const [picker, setPicker] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const memberIds = new Set(members.map((m) => m.id));
  const nonMembers = allPeople.filter((p) => !memberIds.has(p.id));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {members.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2 text-xs font-medium text-slate-700"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-300 text-[9px] text-white">
              {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            {m.name}
            {m.role === "ADMIN" && <span className="text-[9px] text-emerald-600">admin</span>}
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("groupId", groupId);
                  fd.set("employeeId", m.id);
                  startTransition(async () => {
                    await removeGroupMember(fd);
                    router.refresh();
                  });
                }}
                className="text-slate-400 hover:text-red-500"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {canManage && (
          <button
            type="button"
            onClick={() => setPicker((p) => !p)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            <UserPlus size={12} /> Add
          </button>
        )}
      </div>
      {picker && (
        <div className="mt-2 max-h-32 w-56 overflow-y-auto rounded-lg border border-slate-200 p-1">
          {nonMembers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                const fd = new FormData();
                fd.set("groupId", groupId);
                fd.set("employeeId", p.id);
                startTransition(async () => {
                  await addGroupMember(fd);
                  router.refresh();
                });
                setPicker(false);
              }}
              className="block w-full rounded px-2 py-1 text-left text-sm text-slate-600 hover:bg-emerald-50"
            >
              {p.name}
            </button>
          ))}
          {!nonMembers.length && <p className="px-2 py-1 text-xs text-slate-400">Everyone is already in this group.</p>}
        </div>
      )}
    </div>
  );
}
