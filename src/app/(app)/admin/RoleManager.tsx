"use client";

import { useState, useTransition, useRef } from "react";
import { Shield, Plus, Key, Check, Info } from "lucide-react";
import { createRole, updateRolePermissions, createDepartment, createSystemRole } from "@/lib/actions/admin";

interface Role {
  id: string;
  title: string;
  level: number;
  departmentId: string | null;
  permissions?: string[];
}

interface Department {
  id: string;
  name: string;
}

interface RoleManagerProps {
  roles: Role[];
  departments: Department[];
}

const AVAILABLE_PAGES = [
  { id: "dashboard", label: "Dashboard", category: "Core Features" },
  { id: "board", label: "My Board", category: "Core Features" },
  { id: "groups", label: "Groups", category: "Core Features" },
  { id: "subscribed", label: "Subscribed Tasks", category: "Core Features" },
  { id: "templates", label: "Task Templates", category: "Core Features" },
  { id: "deleted", label: "Deleted Tasks", category: "Core Features" },
  { id: "performance", label: "Performance", category: "Core Features" },
  { id: "org", label: "Org Chart", category: "Core Features" },
  { id: "leaderboard", label: "Leaderboard", category: "Core Features" },
  { id: "activities", label: "Activities", category: "Core Features" },
  
  { id: "delegated", label: "Delegated Tasks", category: "Management" },
  { id: "team", label: "My Team", category: "Management" },
  { id: "people", label: "Directory", category: "Management" },
  
  { id: "scores", label: "Score Panel", category: "Administration" },
  { id: "announcements", label: "Announcements", category: "Administration" },
  { id: "insights", label: "AI Insights", category: "Administration" },
  { id: "admin", label: "Admin Panel", category: "Administration" }
];

export default function RoleManager({ roles, departments }: RoleManagerProps) {
  const [openNew, setOpenNew] = useState(false);
  const [openNewDept, setOpenNewDept] = useState(false);
  const [openNewSystemRole, setOpenNewSystemRole] = useState(false);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState<string | null>(null);
  const [newDeptMsg, setNewDeptMsg] = useState<string | null>(null);
  const [newSystemRoleMsg, setNewSystemRoleMsg] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Tracks edited state of permissions locally per role before saving
  const [editedPerms, setEditedPerms] = useState<Record<string, string[]>>({});

  function handleCheckboxChange(roleId: string, pageId: string, checked: boolean) {
    const current = editedPerms[roleId] ?? roles.find(r => r.id === roleId)?.permissions ?? [];
    const updated = checked 
      ? [...current, pageId]
      : current.filter(p => p !== pageId);
    
    setEditedPerms(prev => ({ ...prev, [roleId]: updated }));
  }

  function handleSavePermissions(roleId: string) {
    const permissions = editedPerms[roleId] ?? roles.find(r => r.id === roleId)?.permissions ?? [];
    
    const fd = new FormData();
    fd.set("roleId", roleId);
    permissions.forEach(p => fd.append("permissions", p));

    startTransition(async () => {
      const res = await updateRolePermissions(fd);
      if (res?.error) {
        setSaveMsg(prev => ({ ...prev, [roleId]: `Error: ${res.error}` }));
      } else {
        setSaveMsg(prev => ({ ...prev, [roleId]: "✓ Permissions saved successfully!" }));
        setTimeout(() => {
          setSaveMsg(prev => {
            const next = { ...prev };
            delete next[roleId];
            return next;
          });
        }, 3000);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Custom Roles & Page Permissions</h3>
          <p className="text-xs text-slate-500">Configure page-level access for every position in the company.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setOpenNew(!openNew); setOpenNewDept(false); setOpenNewSystemRole(false); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 font-medium"
          >
            <Plus size={14} /> Create custom position
          </button>
          <button
            onClick={() => { setOpenNewDept(!openNewDept); setOpenNew(false); setOpenNewSystemRole(false); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 font-medium"
          >
            <Plus size={14} /> Create Department
          </button>
          <button
            onClick={() => { setOpenNewSystemRole(!openNewSystemRole); setOpenNew(false); setOpenNewDept(false); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 font-medium"
          >
            <Plus size={14} /> Create System Role
          </button>
        </div>
      </div>

      {/* New Department form */}
      {openNewDept && (
        <form
          action={async (fd) => {
            const res = await createDepartment(fd);
            if (res?.error) {
              setNewDeptMsg(res.error);
            } else {
              setNewDeptMsg("✓ Department created successfully!");
              setTimeout(() => {
                setOpenNewDept(false);
                setNewDeptMsg(null);
              }, 2000);
            }
          }}
          className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">New Department</h4>
          </div>
          <label className="text-xs font-medium text-slate-600 sm:col-span-2">
            Department Name
            <input name="name" required placeholder="e.g. Quality Control" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700">
              Save Department
            </button>
            {newDeptMsg && <span className="text-xs font-medium text-slate-600">{newDeptMsg}</span>}
          </div>
        </form>
      )}

      {/* New System Role form */}
      {openNewSystemRole && (
        <form
          action={async (fd) => {
            const res = await createSystemRole(fd);
            if (res?.error) {
              setNewSystemRoleMsg(res.error);
            } else {
              setNewSystemRoleMsg("✓ System role created successfully!");
              setTimeout(() => {
                setOpenNewSystemRole(false);
                setNewSystemRoleMsg(null);
              }, 2000);
            }
          }}
          className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">New System Role (Access Level)</h4>
          </div>
          <label className="text-xs font-medium text-slate-600 sm:col-span-2">
            System Role Name
            <input name="name" required placeholder="e.g. HOD, DIRECTOR" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" name="isManager" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            Has Manager Permissions (e.g. view team, assign tasks)
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" name="isAdmin" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            Has Admin Permissions (e.g. full config panel)
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700">
              Save System Role
            </button>
            {newSystemRoleMsg && <span className="text-xs font-medium text-slate-600">{newSystemRoleMsg}</span>}
          </div>
        </form>
      )}

      {/* New Role form */}
      {openNew && (
        <form
          ref={formRef}
          action={async (fd) => {
            const res = await createRole(fd);
            if (res?.error) setNewMsg(res.error);
            else {
              setNewMsg("✓ Position created successfully!");
              formRef.current?.reset();
              setTimeout(() => {
                setOpenNew(false);
                setNewMsg(null);
              }, 2000);
            }
          }}
          className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">New Custom Position</h4>
          </div>
          <label className="text-xs font-medium text-slate-600">
            Position title
            <input name="title" required placeholder="e.g. Finance Analyst" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Organizational level (1 highest, 10 lowest)
            <input name="level" type="number" required defaultValue="5" min="1" max="10" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </label>
          <label className="text-xs font-medium text-slate-600 sm:col-span-2">
            Department
            <select name="departmentId" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option value="">— General / No Department —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>

          <div className="sm:col-span-2 space-y-2">
            <span className="text-xs font-semibold text-slate-600 block">Default Granted Pages</span>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
              {AVAILABLE_PAGES.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded border border-slate-200 bg-white p-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" name="permissions" value={p.id} defaultChecked={p.category === "Core Features"} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 flex items-center gap-3">
            <button className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700">
              Save custom position
            </button>
            {newMsg && <span className="text-xs font-medium text-slate-600">{newMsg}</span>}
          </div>
        </form>
      )}

      {/* List of roles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => {
          const isSelected = activeRole === role.id;
          const currentPermissions = editedPerms[role.id] ?? role.permissions ?? [];
          const isMsg = saveMsg[role.id];

          return (
            <div
              key={role.id}
              className={`rounded-xl border transition-all ${
                isSelected 
                  ? "border-blue-200 bg-blue-50/20 ring-2 ring-blue-100" 
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="p-4 flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-slate-800 text-sm">{role.title}</h4>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 font-medium">
                    <span>Org Level: {role.level}</span>
                    <span>•</span>
                    <span>{currentPermissions.length} page accesses</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveRole(isSelected ? null : role.id)}
                  className={`rounded-lg border p-1.5 transition ${
                    isSelected 
                      ? "bg-blue-600 border-blue-600 text-white" 
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                  title="Configure permissions"
                >
                  <Key size={14} />
                </button>
              </div>

              {isSelected && (
                <div className="border-t border-slate-200 p-4 bg-white rounded-b-xl space-y-4">
                  <div className="space-y-3">
                    {/* Render by Category */}
                    {["Core Features", "Management", "Administration"].map((category) => {
                      const list = AVAILABLE_PAGES.filter(p => p.category === category);
                      return (
                        <div key={category} className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{category}</span>
                          <div className="grid gap-1.5 grid-cols-2">
                            {list.map((page) => {
                              const isChecked = currentPermissions.includes(page.id);
                              return (
                                <label key={page.id} className="flex items-center gap-2 text-xs text-slate-600 select-none cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => handleCheckboxChange(role.id, page.id, e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className={isChecked ? "font-medium text-slate-800" : ""}>{page.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <button
                      onClick={() => handleSavePermissions(role.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <Check size={13} /> Save access
                    </button>
                    {isMsg && (
                      <span className={`text-[10px] font-medium ${isMsg.startsWith("✓") ? "text-emerald-600" : "text-red-500"}`}>
                        {isMsg}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
