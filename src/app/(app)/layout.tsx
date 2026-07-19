import { redirect } from "next/navigation";
import { getCurrentUser, isManagerLike, canScoreCompanyWide } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { getAlerts } from "@/lib/alerts";
import Sidebar from "./_components/Sidebar";
import NotificationBell from "./_components/NotificationBell";
import ReminderPoller from "./_components/ReminderPoller";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const alerts = await getAlerts(user);

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="Northern Star Engineering" className="h-9 w-9" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Northern Star</div>
            <div className="text-[11px] text-slate-500">Engineering</div>
          </div>
        </div>
        <Sidebar
          showManager={isManagerLike(user.systemRole)}
          showAdmin={user.systemRole === "ADMIN" || user.systemRole === "CEO"}
          showScoring={canScoreCompanyWide(user)}
        />
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="text-sm text-slate-500 md:hidden">Northern Star Ops</div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell alerts={alerts} />
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-[11px] text-slate-500">{user.role.title}</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
              {initials}
            </div>
            <form action={logoutAction}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-5">{children}</main>
      </div>
      <ReminderPoller />
    </div>
  );
}
