import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const resolvedUser = {
    name: user.name,
    email: user.email,
    birthday: user.birthday || undefined,
    avatarUrl: user.avatarUrl || undefined,
    roleTitle: user.role?.title || "No Role Assigned",
    departmentName: user.role?.department?.name || "No Department Assigned",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500">
          Manage your personal information, profile photo, and contact details.
        </p>
      </div>

      <ProfileForm user={resolvedUser} />
    </div>
  );
}
