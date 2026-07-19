"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  TrendingUp,
  Contact,
  NotebookPen,
  Settings,
  Network,
  ClipboardCheck,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: React.ElementType };

export default function Sidebar({
  showManager,
  showAdmin,
  showScoring,
}: {
  showManager: boolean;
  showAdmin: boolean;
  showScoring: boolean;
}) {
  const pathname = usePathname();

  const items: Item[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/board", label: "My Board", icon: KanbanSquare },
    ...(showManager ? [{ href: "/team", label: "My Team", icon: Users }] : []),
    { href: "/performance", label: "Performance", icon: TrendingUp },
    { href: "/reflection", label: "Weekly Reflection", icon: NotebookPen },
    { href: "/org", label: "Org Chart", icon: Network },
    ...(showScoring ? [{ href: "/scores", label: "Score Panel", icon: ClipboardCheck }] : []),
    ...(showManager ? [{ href: "/people", label: "Directory", icon: Contact }] : []),
    ...(showAdmin ? [{ href: "/leaderboard", label: "Leaderboard", icon: Trophy }] : []),
    ...(showAdmin ? [{ href: "/admin", label: "Admin", icon: Settings }] : []),
  ];

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
