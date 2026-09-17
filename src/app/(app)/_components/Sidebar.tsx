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
  Settings,
  Network,
  ClipboardCheck,
  Trophy,
  Megaphone,
  Share2,
  Bell,
  Trash2,
  Activity,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Item = {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  condition?: boolean;
};

type Section = {
  title: string;
  items: Item[];
};

function hasPermission(
  permission: string | undefined,
  userPermissions: string[] | null,
  systemRole: string,
  isManager: boolean,
  canScore: boolean
) {
  if (!permission) return true;
  if (userPermissions) {
    return userPermissions.includes(permission);
  }
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

  const sections: Section[] = [
    {
      title: "TASKS",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
        ...(canViewAllTasks ? [{ href: "/all-tasks", label: "All tasks", icon: ClipboardCheck }] : []),
        { href: "/board", label: "My board", icon: KanbanSquare, permission: "board" },
        { href: "/groups", label: "Groups", icon: Users2, permission: "groups" },
        { href: "/delegated", label: "Delegated Tasks", icon: Share2, permission: "delegated" },
        { href: "/subscribed", label: "Subscribed Tasks", icon: Bell, permission: "subscribed" },
        { href: "/deleted", label: "Deleted Tasks", icon: Trash2, permission: "deleted" },
      ],
    },
    {
      title: "SCORE",
      items: [
        { href: "/leaderboard", label: "Leaderboard", icon: Trophy, permission: "leaderboard" },
        { href: "/team", label: "My Team", icon: Users, permission: "team" },
        { href: "/performance", label: "Performance", icon: TrendingUp, permission: "performance" },
      ],
    },
    {
      title: "SETTINGS",
      items: [
        { href: "/people", label: "Directory", icon: Contact, permission: "people" },
        { href: "/activities", label: "Activities", icon: Activity, permission: "activities" },
        { href: "/org", label: "Org structure", icon: Network, permission: "org" },
        { href: "/announcements", label: "Announcements", icon: Megaphone, permission: "announcements" },
        { href: "/profile", label: "My profile", icon: User },
        { href: "/admin", label: "Admin", icon: Settings, permission: "admin" },
      ],
    },
  ];

  return (
    <nav className="flex flex-col gap-5 p-3 overflow-y-auto">
      {sections.map((section) => {
        const visibleItems = section.items.filter((item) =>
          hasPermission(item.permission, userPermissions, systemRole, isManager, canScore)
        );

        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title} className="flex flex-col gap-1">
            <div className="px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              {section.title}
            </div>
            {visibleItems.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

