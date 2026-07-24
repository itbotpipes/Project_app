"use client";

import Link from "next/link";
import { useTaskDrawer } from "./TaskDrawerContext";

/**
 * Drop-in replacement for `<Link href={`/task/${id}`}>` — opens the task in
 * the slide-over drawer on a normal click, while still behaving like a real
 * link (cmd/ctrl/shift/middle-click opens `/task/[id]` normally, e.g. in a
 * new tab) and degrading gracefully to a plain link if used outside the
 * TaskDrawerProvider.
 */
export default function TaskLink({
  taskId,
  className,
  draggable,
  children,
  onClickCapture,
}: {
  taskId: string;
  className?: string;
  draggable?: boolean;
  children: React.ReactNode;
  onClickCapture?: () => void;
}) {
  const ctx = useTaskDrawer();

  return (
    <Link
      href={`/task/${taskId}`}
      draggable={draggable}
      className={className}
      onClick={(e) => {
        onClickCapture?.();
        if (!ctx) return; // no provider — behave as a normal link
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let modifier-clicks through
        e.preventDefault();
        ctx.open(taskId);
      }}
    >
      {children}
    </Link>
  );
}
