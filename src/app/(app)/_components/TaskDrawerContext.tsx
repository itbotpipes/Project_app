"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Ctx = { openTaskId: string | null; open: (id: string) => void; close: () => void };
const TaskDrawerCtx = createContext<Ctx | null>(null);

export function TaskDrawerProvider({ children }: { children: React.ReactNode }) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const open = useCallback((id: string) => setOpenTaskId(id), []);
  const close = useCallback(() => setOpenTaskId(null), []);
  const value = useMemo(() => ({ openTaskId, open, close }), [openTaskId, open, close]);
  return <TaskDrawerCtx.Provider value={value}>{children}</TaskDrawerCtx.Provider>;
}

/** Returns null (instead of throwing) if used outside a provider, so
 * call-sites can gracefully fall back to a plain <Link>. */
export function useTaskDrawer() {
  return useContext(TaskDrawerCtx);
}
