import { redirect } from "next/navigation";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { relativeTime } from "@/lib/date";
import ActivitiesView, { ActivityItem } from "./ActivitiesView";

export default async function ActivitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isManager = isManagerLike(user.systemRole) || user.isAdmin || user.isManager;

  // 1. Fetch AuditLog records
  let logsSnap;
  if (isManager) {
    logsSnap = await adminDb.collection("AuditLog").orderBy("createdAt", "desc").limit(200).get();
  } else {
    logsSnap = await adminDb
      .collection("AuditLog")
      .where("actorId", "==", user.id)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
  }

  // 2. Extract referenced Actor IDs, Task IDs, and Department references
  const rawDocs = logsSnap.docs || [];
  const actorIds = new Set<string>();
  const taskIds = new Set<string>();

  for (const d of rawDocs) {
    const data = d.data();
    if (data.actorId) actorIds.add(data.actorId);
    if (data.entity === "Task" && data.entityId) {
      taskIds.add(data.entityId);
    }
  }

  // 3. Parallel fetch Employees, referenced Tasks, and Departments
  const [employeesSnap, tasksSnap, departmentsSnap, rolesSnap] = await Promise.all([
    actorIds.size > 0 ? adminDb.collection("Employee").get() : Promise.resolve({ docs: [] }),
    taskIds.size > 0
      ? Promise.all(Array.from(taskIds).map((id) => adminDb.collection("Task").doc(id).get()))
      : Promise.resolve([]),
    adminDb.collection("Department").get(),
    adminDb.collection("Role").get(),
  ]);

  // Build lookup maps
  const employeeMap = new Map<string, any>();
  const allEmployeesList: Array<{ id: string; name: string }> = [];
  for (const doc of employeesSnap.docs || []) {
    const d = doc.data();
    employeeMap.set(doc.id, {
      id: doc.id,
      name: d.name || "Unknown",
      email: d.email || "",
      avatarUrl: d.avatarUrl || null,
      roleId: d.roleId || null,
    });
    allEmployeesList.push({ id: doc.id, name: d.name || "Unknown" });
  }
  allEmployeesList.sort((a, b) => a.name.localeCompare(b.name));

  const roleMap = new Map<string, any>();
  for (const doc of rolesSnap.docs || []) {
    roleMap.set(doc.id, doc.data());
  }

  const taskMap = new Map<string, any>();
  for (const doc of tasksSnap) {
    if (doc.exists) {
      taskMap.set(doc.id, { id: doc.id, title: doc.data()!.title });
    }
  }

  const deptMap = new Map<string, string>();
  for (const doc of departmentsSnap.docs || []) {
    deptMap.set(doc.id, doc.data().name);
  }

  // 4. Enrich each audit log into a human-readable ActivityItem
  const activityItems: ActivityItem[] = rawDocs.map((doc) => {
    const d = doc.data();
    const actorData = d.actorId ? employeeMap.get(d.actorId) : null;
    const actorRole = actorData?.roleId ? roleMap.get(actorData.roleId)?.title : null;

    const createdAtDate = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || Date.now());
    const createdAtIso = createdAtDate.toISOString();
    const timeAgo = relativeTime(createdAtDate);

    const action = String(d.action || "");
    const detail = String(d.detail || "").trim();
    const entity = String(d.entity || "");
    const entityId = d.entityId ? String(d.entityId) : null;

    let category: ActivityItem["category"] = "system";
    let actionTitle = action;
    let badgeText = "Activity";
    let badgeTone: ActivityItem["badgeTone"] = "slate";
    let iconType = "activity";
    let cleanDetail: string | null = detail || null;
    let reason: string | null = null;
    let taskTitle: string | null = null;

    // Task Activities
    if (entity === "Task" || action.startsWith("task.")) {
      category = "task";
      const foundTask = entityId ? taskMap.get(entityId) : null;
      taskTitle = foundTask?.title || null;

      if (!taskTitle && detail && !detail.startsWith("Set ") && !detail.startsWith("ON_HOLD") && !detail.startsWith("CLOSED") && !detail.startsWith("IN_PROGRESS") && !detail.startsWith("REOPENED") && !detail.startsWith("TODO")) {
        taskTitle = detail;
      }

      if (action === "task.create") {
        actionTitle = "Created a task";
        badgeText = "Created";
        badgeTone = "violet";
        iconType = "plus";
      } else if (action === "task.fromTemplate") {
        actionTitle = "Created task from template";
        badgeText = "Template";
        badgeTone = "violet";
        iconType = "file-text";
      } else if (action === "task.move" || action === "task.status") {
        if (detail.includes("CLOSED")) {
          actionTitle = "Marked task as completed";
          badgeText = "Completed";
          badgeTone = "emerald";
          iconType = "check";
          cleanDetail = "Status changed to Closed";
        } else if (detail.includes("IN_PROGRESS")) {
          actionTitle = "Started working on task";
          badgeText = "In Progress";
          badgeTone = "blue";
          iconType = "play";
          cleanDetail = "Moved to In Progress";
        } else if (detail.includes("ON_HOLD")) {
          actionTitle = "Put task on hold";
          badgeText = "On Hold";
          badgeTone = "amber";
          iconType = "pause";
          const match = detail.match(/\((.*?)\)/);
          if (match && match[1] && match[1] !== ".") {
            reason = match[1];
          }
          cleanDetail = reason ? `Put on hold: "${reason}"` : "Put task on hold";
        } else if (detail.includes("PENDING_REVIEW")) {
          actionTitle = "Submitted task for review";
          badgeText = "In Review";
          badgeTone = "indigo";
          iconType = "clock";
          cleanDetail = "Awaiting manager approval";
        } else if (detail.includes("TODO")) {
          actionTitle = "Moved task to backlog";
          badgeText = "Todo";
          badgeTone = "slate";
          iconType = "clock";
          cleanDetail = "Moved to Todo";
        } else {
          actionTitle = "Updated task status";
          badgeText = "Status";
          badgeTone = "blue";
          iconType = "play";
          cleanDetail = detail;
        }
      } else if (action === "task.reject" || action.includes("reject")) {
        actionTitle = "Sent task back for rework";
        badgeText = "Rework";
        badgeTone = "rose";
        iconType = "rotate-ccw";
        reason = detail;
        cleanDetail = reason ? `Rework requested: ${reason}` : "Sent back for rework";
      } else if (action === "task.delete") {
        actionTitle = "Deleted a task";
        badgeText = "Deleted";
        badgeTone = "rose";
        iconType = "trash";
      } else if (action === "task.restore") {
        actionTitle = "Restored task from trash";
        badgeText = "Restored";
        badgeTone = "emerald";
        iconType = "rotate-ccw";
      } else if (action === "task.edit") {
        actionTitle = "Edited task details";
        badgeText = "Edited";
        badgeTone = "slate";
        iconType = "edit";
      } else if (action === "task.comment") {
        actionTitle = "Posted a comment";
        badgeText = "Comment";
        badgeTone = "blue";
        iconType = "message";
      } else if (action === "task.attachment") {
        actionTitle = "Attached file to task";
        badgeText = "Attachment";
        badgeTone = "slate";
        iconType = "file";
      } else if (action === "task.exchange") {
        actionTitle = "Reassigned task";
        badgeText = "Reassigned";
        badgeTone = "blue";
        iconType = "play";
      }
    }

    // Team & People Activities
    else if (action.startsWith("employee.") || entity === "Employee") {
      category = "team";
      if (action === "employee.create") {
        actionTitle = "Onboarded new team member";
        badgeText = "New Member";
        badgeTone = "emerald";
        iconType = "user-plus";
      } else if (action === "employee.updateDepartment") {
        actionTitle = "Updated department assignment";
        badgeText = "Department";
        badgeTone = "sky";
        iconType = "building";

        const deptIdMatch = detail.match(/Set department to ([a-zA-Z0-9_-]+)/);
        if (deptIdMatch && deptIdMatch[1]) {
          const rawId = deptIdMatch[1];
          const dName = deptMap.get(rawId) || (rawId === "null" || rawId === "General" ? "General / Unassigned" : rawId);
          cleanDetail = `Assigned department to "${dName}"`;
        }
      } else if (action === "employee.updateHierarchy") {
        actionTitle = "Updated manager reporting line";
        badgeText = "Hierarchy";
        badgeTone = "indigo";
        iconType = "branch";
      } else if (action === "employee.profile_update" || action === "employee.update") {
        actionTitle = "Updated profile information";
        badgeText = "Profile";
        badgeTone = "slate";
        iconType = "user";
        cleanDetail = detail.replace(/<.*?>/g, "");
      }
    }

    // Department Activities
    else if (action.startsWith("department.") || entity === "Department") {
      category = "admin";
      if (action === "department.create") {
        actionTitle = `Created department "${detail}"`;
        badgeText = "New Dept";
        badgeTone = "emerald";
        iconType = "building";
      } else if (action === "department.update") {
        actionTitle = `Renamed department to "${detail}"`;
        badgeText = "Dept Update";
        badgeTone = "sky";
        iconType = "building";
      } else if (action === "department.delete") {
        actionTitle = `Deleted department "${detail}"`;
        badgeText = "Dept Deleted";
        badgeTone = "rose";
        iconType = "trash";
      } else if (action === "department.assignEmployees") {
        actionTitle = "Assigned team members to department";
        badgeText = "Assignment";
        badgeTone = "sky";
        iconType = "users";
      }
    }

    // Role Activities
    else if (action.startsWith("role.") || entity === "Role") {
      category = "admin";
      if (action === "role.create") {
        actionTitle = `Created position role "${detail}"`;
        badgeText = "New Role";
        badgeTone = "indigo";
        iconType = "shield";
      } else if (action === "role.permissions") {
        actionTitle = "Configured role page permissions";
        badgeText = "Permissions";
        badgeTone = "indigo";
        iconType = "shield";
      } else if (action === "role.changeDepartment") {
        actionTitle = detail || "Moved role position to department";
        badgeText = "Role Update";
        badgeTone = "indigo";
        iconType = "shield";
      }
    }

    // KPI Activities
    else if (action.startsWith("kpi.") || entity === "KpiTemplate") {
      category = "kpi";
      if (action === "kpi.create") {
        actionTitle = "Created KPI template";
        badgeText = "New KPI";
        badgeTone = "violet";
        iconType = "file-text";
      } else if (action === "kpi.update") {
        actionTitle = "Updated KPI template";
        badgeText = "KPI Update";
        badgeTone = "violet";
        iconType = "file-text";
      } else if (action === "kpi.delete") {
        actionTitle = `Deleted KPI template "${detail}"`;
        badgeText = "KPI Deleted";
        badgeTone = "rose";
        iconType = "trash";
      }
    }

    // Group Activities
    else if (action.startsWith("group.") || entity === "Group") {
      category = "team";
      if (action === "group.create") {
        actionTitle = `Created team group "${detail}"`;
        badgeText = "New Group";
        badgeTone = "blue";
        iconType = "users";
      } else if (action === "group.delete") {
        actionTitle = `Deleted group "${detail}"`;
        badgeText = "Group Deleted";
        badgeTone = "rose";
        iconType = "trash";
      }
    }

    // Scores & Reviews
    else if (action.startsWith("score.") || action.startsWith("behaviour.")) {
      category = "admin";
      actionTitle = action.includes("finalize")
        ? "Finalized monthly scorecard"
        : "Saved employee behaviour review";
      badgeText = "Scorecard";
      badgeTone = "amber";
      iconType = "award";
    }

    return {
      id: doc.id,
      action,
      actionTitle,
      category,
      badgeText,
      badgeTone,
      iconType,
      entity,
      entityId,
      taskTitle,
      detail,
      cleanDetail,
      reason,
      actor: {
        id: actorData?.id,
        name: actorData?.name || "System",
        email: actorData?.email,
        avatarUrl: actorData?.avatarUrl || null,
        roleTitle: actorRole,
      },
      createdAtIso,
      relativeTime: timeAgo,
    };
  });

  return (
    <ActivitiesView
      logs={activityItems}
      isManager={isManager}
      employees={allEmployeesList}
    />
  );
}
