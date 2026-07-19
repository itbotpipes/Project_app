"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue="director@nse.local"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          defaultValue="password123"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>
      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
