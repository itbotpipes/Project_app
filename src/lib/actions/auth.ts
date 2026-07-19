"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Enter email and password." };

  const user = await prisma.employee.findUnique({ where: { email } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
