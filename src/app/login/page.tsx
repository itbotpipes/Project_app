import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="Northern Star Engineering" className="mx-auto mb-3 h-16 w-16" />
          <h1 className="text-2xl font-semibold">
            Task<span className="text-blue-600">Flow</span>
          </h1>
          <p className="text-sm text-slate-500">Northern Star Engineering · task &amp; performance system</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Demo login: <span className="font-medium">director@nse.local</span> / password123
        </p>
      </div>
    </div>
  );
}
