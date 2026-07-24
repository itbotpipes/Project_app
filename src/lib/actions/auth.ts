"use server";

import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Enter email and password." };

  const snap = await adminDb.collection("Employee").where("email", "==", email).limit(1).get();
  if (snap.empty) return { error: "Invalid email or password." };
  
  const userDoc = snap.docs[0];
  const user = userDoc.data();
  
  if (!user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  await createSession(userDoc.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
