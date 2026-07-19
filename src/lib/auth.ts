import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const COOKIE = "ops_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-only-change-me",
);

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(employeeId: string) {
  const token = await new SignJWT({ sub: employeeId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

async function getSessionEmployeeId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

export async function getCurrentUser() {
  const id = await getSessionEmployeeId();
  if (!id) return null;
  const user = await prisma.employee.findUnique({
    where: { id },
    include: { role: { include: { department: true } } },
  });
  if (!user || !user.active) return null;
  return user;
}

export function isManagerLike(systemRole: string) {
  return systemRole === "ADMIN" || systemRole === "CEO" || systemRole === "MANAGER";
}

type ScoringUser = { systemRole: string; role: { title: string } };

/** Company-wide scoring visibility: ADMIN/CEO always, plus HR (per the COO's request). */
export function canScoreCompanyWide(user: ScoringUser) {
  return (
    user.systemRole === "ADMIN" ||
    user.systemRole === "CEO" ||
    user.role.title.toLowerCase().includes("hr")
  );
}
