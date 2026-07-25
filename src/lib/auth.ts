import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

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

import { adminDb } from "./firebase/admin";

export type CurrentUser = any; // Will be properly typed when we rewrite the Employee model

export async function getCurrentUser() {
  const id = await getSessionEmployeeId();
  if (!id) return null;
  
  const userDoc = await adminDb.collection("Employee").doc(id).get();
  if (!userDoc.exists) return null;
  
  const userData = userDoc.data();
  if (!userData || !userData.active) return null;
  
  // Convert Firestore Timestamps to Dates for serialization
  const serializedUser: any = {};
  for (const [key, value] of Object.entries(userData)) {
    if (value && typeof value === 'object' && 'toDate' in value) {
      serializedUser[key] = (value as any).toDate();
    } else {
      serializedUser[key] = value;
    }
  }
  
  // Note: Resolving relations manually since Firestore is NoSQL
  let roleData: any = null;
  if (serializedUser.roleId) {
    const roleDoc = await adminDb.collection("Role").doc(serializedUser.roleId).get();
    if (roleDoc.exists) {
      const rawRoleData = roleDoc.data();
      // Convert role data timestamps
      roleData = {};
      for (const [key, value] of Object.entries(rawRoleData || {})) {
        if (value && typeof value === 'object' && 'toDate' in value) {
          (roleData as any)[key] = (value as any).toDate();
        } else {
          (roleData as any)[key] = value;
        }
      }
      if (roleData && roleData.departmentId) {
        const deptDoc = await adminDb.collection("Department").doc(roleData.departmentId).get();
        if (deptDoc.exists) {
          const rawDeptData = deptDoc.data();
          // Convert department data timestamps
          const deptData: any = {};
          for (const [key, value] of Object.entries(rawDeptData || {})) {
            if (value && typeof value === 'object' && 'toDate' in value) {
              deptData[key] = (value as any).toDate();
            } else {
              deptData[key] = value;
            }
          }
          roleData.department = deptData;
        }
      }
    }
  }
  
  return { id, ...serializedUser, role: roleData } as any;
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
