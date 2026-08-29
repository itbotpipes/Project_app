"use client";

import { useState } from "react";
import { updateProfile } from "@/lib/actions/profile";
import Avatar from "../_components/Avatar";
import { Card } from "../_components/ui";
import { Camera, User, Calendar, Mail, ShieldAlert, Check } from "lucide-react";

type ProfileUser = {
  name: string;
  email: string;
  phone?: string;
  birthday?: Date;
  avatarUrl?: string;
  roleTitle?: string;
  departmentName?: string;
};

export default function ProfileForm({ user }: { user: ProfileUser }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.avatarUrl || null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const res = await updateProfile(formData);

    setLoading(false);
    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const formattedBirthday = user.birthday
    ? new Date(user.birthday).toISOString().slice(0, 10)
    : "";

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Profile summary card */}
      <Card className="flex flex-col items-center justify-center p-6 text-center md:col-span-1">
        <div className="relative group cursor-pointer">
          <Avatar name={user.name} url={previewUrl || undefined} size={112} />
          <label className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-white shadow hover:bg-blue-700 transition cursor-pointer">
            <Camera size={14} />
            <input
              type="file"
              name="avatarFile"
              form="profile-form"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </label>
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">{user.name}</h2>
        <p className="text-sm font-medium text-blue-600">{user.roleTitle}</p>
        <p className="text-xs text-slate-400 mt-0.5">{user.departmentName}</p>

        <div className="mt-6 w-full border-t border-slate-100 pt-6 text-left space-y-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-500">
            <Mail size={14} className="text-slate-400" />
            <span className="truncate">{user.email}</span>
          </div>
        </div>
      </Card>

      {/* Edit Form */}
      <Card className="md:col-span-2">
        <form id="profile-form" onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Personal Information</h3>
            <p className="text-xs text-slate-500">Update your public details used across notifications and leaderboards.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={user.name}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Birthday
              </label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Calendar size={16} />
                </span>
                <input
                  type="date"
                  name="birthday"
                  defaultValue={formattedBirthday}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Email Address <span className="text-[10px] text-slate-400">(Read-only)</span>
              </label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2 pl-9 pr-3 text-sm text-slate-400 outline-none cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex gap-3 items-start">
            <ShieldAlert size={18} className="text-slate-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Account Credentials:</span> You cannot modify your email address or password from this screen. Please contact the company administration if an update to your credentials is required.
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 flex items-center gap-2">
              <Check size={16} className="bg-emerald-500 text-white rounded-full p-0.5" />
              Profile updated successfully!
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50 min-w-32"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
