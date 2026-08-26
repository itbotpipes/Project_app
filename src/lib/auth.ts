import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cache } from "react";

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
import { fetchAllRoles, fetchAllDepartments } from "./cache";

export type CurrentUser = any; // Will be properly typed when we rewrite the Employee model

export const getCurrentUser = cache(async () => {
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
    const rolesSnap = await fetchAllRoles(adminDb);
    const roleDoc = rolesSnap.docs?.find((d: any) => d.id === serializedUser.roleId);
    
    if (roleDoc) {
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
        const deptsSnap = await fetchAllDepartments(adminDb);
        const deptDoc = deptsSnap.docs?.find((d: any) => d.id === roleData.departmentId);
        if (deptDoc) {
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
  
  const systemRoleDocSnap = await adminDb.collection("SystemRole").where("name", "==", serializedUser.systemRole).limit(1).get();
  let systemRoleObj = { isManager: false, isAdmin: false };
  if (!systemRoleDocSnap.empty) {
    const data = systemRoleDocSnap.docs[0].data();
    systemRoleObj = { isManager: !!data.isManager, isAdmin: !!data.isAdmin };
  } else {
    if (["ADMIN", "CEO"].includes(serializedUser.systemRole)) {
      systemRoleObj = { isManager: true, isAdmin: true };
    } else if (serializedUser.systemRole === "MANAGER") {
      systemRoleObj = { isManager: true, isAdmin: false };
    }
  }

  return { id, ...serializedUser, role: roleData, systemRoleObj } as any;
});

export function isManagerLike(userOrRole: any, systemRoleObj?: { isManager: boolean; isAdmin: boolean }) {
  if (!userOrRole) return false;
  if (typeof userOrRole === 'object') {
    const sObj = userOrRole.systemRoleObj || systemRoleObj;
    if (sObj) return sObj.isManager || sObj.isAdmin;
    return userOrRole.systemRole === "ADMIN" || userOrRole.systemRole === "CEO" || userOrRole.systemRole === "MANAGER";
  }
  if (systemRoleObj) {
    return systemRoleObj.isManager || systemRoleObj.isAdmin;
  }
  return userOrRole === "ADMIN" || userOrRole === "CEO" || userOrRole === "MANAGER";
}

type ScoringUser = { systemRole: string; systemRoleObj?: { isManager: boolean; isAdmin: boolean }; role: { title: string } };

/** Company-wide scoring visibility: ADMIN/CEO always, plus HR (per the COO's request). */
export function canScoreCompanyWide(user: ScoringUser) {
  const isAdmin = user.systemRoleObj ? user.systemRoleObj.isAdmin : (user.systemRole === "ADMIN" || user.systemRole === "CEO");
  return (
    isAdmin ||
    user.role.title.toLowerCase().includes("hr")
  );
}

export function hasPermission(user: any, permission: string): boolean {
  if (!user) return false;
  
  if (user.role?.permissions) {
    return user.role.permissions.includes(permission);
  }
  
  // Fallbacks using legacy rules
  const isAdmin = user.systemRoleObj ? user.systemRoleObj.isAdmin : (user.systemRole === "ADMIN" || user.systemRole === "CEO");
  const isMgr = isManagerLike(user.systemRole, user.systemRoleObj);
  switch (permission) {
    case "admin":
      return isAdmin;
    case "delegated":
    case "team":
    case "people":
      return isMgr;
    case "scores":
    case "announcements":
      return canScoreCompanyWide(user);
    default:
      return true;
  }
}
