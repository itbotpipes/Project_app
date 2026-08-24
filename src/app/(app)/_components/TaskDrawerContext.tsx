"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { TaskDetailData } from "@/lib/taskDetail";

type Ctx = {
  openTaskId: string | null;
  taskData: NonNullable<TaskDetailData> | null;
  setTaskData: React.Dispatch<React.SetStateAction<NonNullable<TaskDetailData> | null>>;
  open: (id: string) => void;
  close: () => void;
  refresh: () => void;
  refreshTrigger: number;
};
const TaskDrawerCtx = createContext<Ctx | null>(null);

export function TaskDrawerProvider({ children }: { children: React.ReactNode }) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [taskData, setTaskData] = useState<NonNullable<TaskDetailData> | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const open = useCallback((id: string) => setOpenTaskId(id), []);
  const close = useCallback(() => setOpenTaskId(null), []);
  const refresh = useCallback(() => setRefreshTrigger((prev) => prev + 1), []);
  
  const value = useMemo(() => ({ 
    openTaskId, 
    taskData, 
    setTaskData, 
    open, 
    close, 
    refresh, 
    refreshTrigger 
  }), [openTaskId, taskData, open, close, refresh, refreshTrigger]);
  return <TaskDrawerCtx.Provider value={value}>{children}</TaskDrawerCtx.Provider>;
}

/** Returns null (instead of throwing) if used outside a provider, so
 * call-sites can gracefully fall back to a plain <Link>. */
export function useTaskDrawer() {
  return useContext(TaskDrawerCtx);
}
