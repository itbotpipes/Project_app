"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Users2,
  TrendingUp,
  Contact,
  Sparkles,
  Settings,
  Network,
  ClipboardCheck,
  Trophy,
  Megaphone,
  Share2,
  Bell,
  BookmarkCheck,
  Trash2,
  Activity,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: React.ElementType };

function hasPermission(
  permission: string,
  userPermissions: string[] | null,
  systemRole: string,
  isManager: boolean,
  canScore: boolean
) {
  if (userPermissions) {
    return userPermissions.includes(permission);
  }
  // Fallbacks using legacy rules
  switch (permission) {
    case "admin":
      return systemRole === "ADMIN" || systemRole === "CEO";
    case "delegated":
    case "team":
    case "people":
      return isManager;
    case "scores":
    case "announcements":
      return canScore;
    default:
      return true;
  }
}

export default function Sidebar({
  userPermissions,
  systemRole,
  isManager,
  canScore,
  canViewAllTasks = false,
}: {
  userPermissions: string[] | null;
  systemRole: string;
  isManager: boolean;
  canScore: boolean;
  canViewAllTasks?: boolean;
}) {
  const pathname = usePathname();

  const items: Item[] = [
    ...(hasPermission("dashboard", userPermissions, systemRole, isManager, canScore) ? [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] : []),
    { href: "/profile", label: "My Profile", icon: User },
    ...(hasPermission("board", userPermissions, systemRole, isManager, canScore) ? [{ href: "/board", label: "My Board", icon: KanbanSquare }] : []),
    ...(canViewAllTasks ? [{ href: "/all-tasks", label: "All Tasks", icon: ClipboardCheck }] : []),
    ...(hasPermission("groups", userPermissions, systemRole, isManager, canScore) ? [{ href: "/groups", label: "Groups", icon: Users2 }] : []),
    ...(hasPermission("delegated", userPermissions, systemRole, isManager, canScore) ? [{ href: "/delegated", label: "Delegated Tasks", icon: Share2 }] : []),
    ...(hasPermission("subscribed", userPermissions, systemRole, isManager, canScore) ? [{ href: "/subscribed", label: "Subscribed Tasks", icon: Bell }] : []),
    ...(hasPermission("templates", userPermissions, systemRole, isManager, canScore) ? [{ href: "/templates", label: "Task Templates", icon: BookmarkCheck }] : []),
    ...(hasPermission("deleted", userPermissions, systemRole, isManager, canScore) ? [{ href: "/deleted", label: "Deleted Tasks", icon: Trash2 }] : []),
    ...(hasPermission("team", userPermissions, systemRole, isManager, canScore) ? [{ href: "/team", label: "My Team", icon: Users }] : []),
    ...(hasPermission("performance", userPermissions, systemRole, isManager, canScore) ? [{ href: "/performance", label: "Performance", icon: TrendingUp }] : []),
    ...(hasPermission("insights", userPermissions, systemRole, isManager, canScore) ? [{ href: "/insights", label: "AI Insights", icon: Sparkles }] : []),
    ...(hasPermission("org", userPermissions, systemRole, isManager, canScore) ? [{ href: "/org", label: "Org Chart", icon: Network }] : []),
    ...(hasPermission("announcements", userPermissions, systemRole, isManager, canScore) ? [{ href: "/announcements", label: "Announcements", icon: Megaphone }] : []),
    ...(hasPermission("people", userPermissions, systemRole, isManager, canScore) ? [{ href: "/scores", label: "Directory", icon: Contact }] : []),
    ...(hasPermission("leaderboard", userPermissions, systemRole, isManager, canScore) ? [{ href: "/leaderboard", label: "Leaderboard", icon: Trophy }] : []),
    ...(hasPermission("activities", userPermissions, systemRole, isManager, canScore) ? [{ href: "/activities", label: "Activities", icon: Activity }] : []),
    ...(hasPermission("admin", userPermissions, systemRole, isManager, canScore) ? [{ href: "/admin", label: "Admin", icon: Settings }] : []),
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
