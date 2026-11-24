"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendNotification } from "@/lib/notificationService";
import { computeTaskPoints } from "@/lib/qualityPoints";
import { uploadFileBufferToCloudinary } from "@/lib/cloudinaryService";

export async function createTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const title = String(formData.get("title") || "").trim();
  if (!title) return;

  const assigneeId = String(formData.get("assigneeId") || user.id) || user.id;
  const kpiTemplateId = String(formData.get("kpiTemplateId") || "") || null;
  const sizeLabel = String(formData.get("sizeLabel") || "") || null;
  const estimatedMins = formData.get("estimatedMins")
    ? Number(formData.get("estimatedMins"))
    : null;
  const dueRaw = String(formData.get("dueAt") || "");
  const dueAt = dueRaw ? new Date(dueRaw) : null;
  const urgent = formData.get("urgent") === "on";
  const important = formData.get("important") === "on";
  const reviewRequired = formData.get("reviewRequired") === "on";
  const category = String(formData.get("category") || "").trim() || null;
  const concernedContact = String(formData.get("concernedContact") || "").trim() || null;
  const groupId = String(formData.get("groupId") || "") || null;
  const checklist = formData.getAll("checklist").map(String).map((s) => s.trim()).filter(Boolean);
  const watcherIds = formData.getAll("watcherIds").map(String).filter(Boolean);

  let groupMemberIds: string[] = [];
  if (groupId) {
    const membersSnap = await adminDb.collection("GroupMember").where("groupId", "==", groupId).get();
    groupMemberIds = membersSnap.docs ? membersSnap.docs.map((doc: any) => doc.data().employeeId) : [];
  }
  
  const now = new Date();

  if (dueAt) {
    if (dueAt < now) {
      return { error: "Deadline cannot be set before the current time." };
    }
    if (estimatedMins && estimatedMins > 0) {
      const minDue = new Date(now.getTime() + estimatedMins * 60 * 1000);
      if (dueAt < minDue) {
        return { error: `Deadline must be at least ${estimatedMins} minutes in the future (current time + estimated time).` };
      }
    }
  }
  
  const rawAssigneeIds = formData.getAll("assigneeIds").map(String).filter(Boolean);
  const assignees = (assigneeId === "ALL_MEMBERS" && groupMemberIds.length > 0)
    ? groupMemberIds
    : (rawAssigneeIds.length > 0 ? rawAssigneeIds : [assigneeId]);

  let firstId = null;

  for (const targetAssigneeId of assignees) {
    const allWatcherIds = Array.from(new Set([...watcherIds, ...groupMemberIds])).filter((id) => id !== targetAssigneeId);

    // Fetch assignee's reportsToId to determine their direct manager as reviewer
    const assigneeDoc = await adminDb.collection("Employee").doc(targetAssigneeId).get();
    const assigneeData = assigneeDoc.exists ? assigneeDoc.data() : null;
    const reviewerId = reviewRequired ? (assigneeData?.reportsToId || null) : null;

    // Create task in Firestore
    const taskRef = await adminDb.collection("Task").add({
      title,
      description: String(formData.get("description") || "") || null,
      creatorId: user.id,
      assigneeId: targetAssigneeId,
      kpiTemplateId,
      sizeLabel,
      estimatedMins,
      dueAt,
      urgent,
      important,
      reviewRequired,
      reviewerId,
      status: "NEW",
      category,
      concernedContact,
      groupId,
      carryCount: 0,
      reworkCount: 0,
      deletedAt: null,   // must be explicit null for Firestore equality queries
      createdAt: now,
      updatedAt: now,
      lastStatusChange: now,
      statusDurations: {},
    });

    if (!firstId) firstId = taskRef.id;

    // Dispatch notification to assignee if assigned to someone else
    if (targetAssigneeId && targetAssigneeId !== user.id) {
      try {
        await sendNotification({
          recipientId: targetAssigneeId,
          actorId: user.id,
          actorName: user.name || "Colleague",
          taskId: taskRef.id,
          taskTitle: title,
          type: "TASK_ASSIGNED",
          title: "New Task Assigned",
          message: `${user.name || "Colleague"} assigned you "${title}".`,
          href: `/task/${taskRef.id}`,
        });
      } catch (notifErr) {
        console.error("[createTask] Notification error:", notifErr);
      }
    }

    // Create checklist items
    if (checklist.length > 0) {
      const batch = adminDb.batch();
      checklist.forEach((text, i) => {
        const itemRef = adminDb.collection("ChecklistItem").doc();
        batch.set(itemRef, {
          taskId: taskRef.id,
          text,
          orderIndex: i,
          done: false,
          createdAt: now,
        });
      });
      await batch.commit();
    }

    // Create watchers
    if (allWatcherIds.length > 0) {
      const batch = adminDb.batch();
      allWatcherIds.forEach((employeeId) => {
        const watcherRef = adminDb.collection("TaskWatcher").doc();
        batch.set(watcherRef, {
          taskId: taskRef.id,
          employeeId,
          notified: false,
          createdAt: now,
        });
      });
      await batch.commit();
    }

    // Process file attachments added during task creation
    const rawAttachments = formData.getAll("attachments");
    for (const item of rawAttachments) {
      if (item && typeof item === "object" && "size" in item && (item as File).size > 0) {
        try {
          const uploaded = await uploadFileBufferToCloudinary(item as File);
          await adminDb.collection("Attachment").add({
            taskId: taskRef.id,
            kind: uploaded.kind,
            url: uploaded.secureUrl,
            filename: uploaded.filename,
            createdAt: now,
            transcript: null,
          });
        } catch (uploadErr) {
          console.error("[createTask] Attachment upload error:", uploadErr);
        }
      }
    }

    await adminDb.collection("AuditLog").add({
      actorId: user.id,
      action: "task.create",
      entity: "Task",
      entityId: taskRef.id,
      detail: title,
      createdAt: now,
    });

    // Optionally save as a personal template
    const shouldSaveTemplate = formData.get("saveAsTemplate") === "on";
    const customTemplateName = String(formData.get("saveTemplateName") || title).trim();
    if (shouldSaveTemplate && customTemplateName) {
      await adminDb.collection("TaskTemplate").add({
        name: customTemplateName,
        title,
        description: String(formData.get("description") || "") || null,
        kpiTemplateId,
        sizeLabel,
        category,
        roleId: user.roleId || null,
        isPersonal: true,
        createdById: user.id,
        checklistJSON: checklist.length ? JSON.stringify(checklist) : null,
        createdAt: now,
      });
      revalidatePath("/templates");
    }
  }

  revalidatePath("/board");
  revalidatePath("/team");
  revalidatePath("/delegated");
  if (groupId) revalidatePath(`/groups/${groupId}`);
  return { ok: true, id: firstId };
}

export async function updateTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const taskId = String(formData.get("taskId") || "");
  const title = String(formData.get("title") || "").trim();
  if (!taskId || !title) return { error: "Title is required." };

  const taskDoc = await adminDb.collection("Task").doc(taskId).get();
  if (!taskDoc.exists) return { error: "Task not found." };
  const task = taskDoc.data()!;
  
  const allowed = task.creatorId === user.id || task.assigneeId === user.id || isManagerLike(user.systemRole);
  if (!allowed) return { error: "Not allowed to edit this task." };

  const kpiTemplateId = String(formData.get("kpiTemplateId") || "") || null;
  const sizeLabel = String(formData.get("sizeLabel") || "") || null;
  const category = String(formData.get("category") || "").trim() || null;
  const concernedContact = String(formData.get("concernedContact") || "").trim() || null;
  const dueRaw = String(formData.get("dueAt") || "");
  const dueAt = dueRaw ? new Date(dueRaw) : null;
  const urgent = formData.get("urgent") === "on";
  const important = formData.get("important") === "on";

  await adminDb.collection("Task").doc(taskId).update({
    title,
    description: String(formData.get("description") || "") || null,
    kpiTemplateId,
    sizeLabel,
    category,
    concernedContact,
    dueAt,
    urgent,
    important,
    updatedAt: new Date(),
  });

  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.edit",
    entity: "Task",
    entityId: taskId,
    detail: title,
    createdAt: new Date(),
  });

  revalidatePath("/board");
  revalidatePath("/delegated");
  revalidatePath(`/task/${taskId}`);
  return { ok: true };
}

export async function moveTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const taskId = String(formData.get("taskId") || "");
  let status = String(formData.get("status") || "");
  const holdReason = String(formData.get("holdReason") || "") || null;
  const rejectionReason = String(formData.get("rejectionReason") || "") || null;
  if (!taskId || !status) return { error: "Missing fields." };

  const taskDoc = await adminDb.collection("Task").doc(taskId).get();
  if (!taskDoc.exists) return { error: "Task not found." };
  const task = taskDoc.data()!;

  let autoRouted = false;
  if (status === "CLOSED" && task.reviewRequired) {
    const isManager = user.id === task.creatorId || user.id === task.reviewerId || isManagerLike(user.systemRole);
    if (!isManager) {
      status = "PENDING_REVIEW";
      autoRouted = true;
    }
  }

  if (status === "CLOSED") {
    const checklistSnap = await adminDb.collection("ChecklistItem").where("taskId", "==", taskId).get();
    const total = checklistSnap.size;
    const doneCount = checklistSnap.docs.filter(doc => doc.data().done).length;
    if (total > 0 && doneCount < total) {
      return { error: `Finish the checklist first — ${doneCount}/${total} items ticked.` };
    }
  }

  if (status === "REOPENED" && !rejectionReason) {
    return { error: "A reason is required when sending a task back for rework." };
  }

  const now = new Date();
  const prevStatus = task.status;
  const data: Record<string, any> = { status, updatedAt: now };

  if (status !== prevStatus) {
    let elapsedSeconds = 0;
    if (task.lastStatusChange) {
      const lastChange = task.lastStatusChange.toDate ? task.lastStatusChange.toDate() : new Date(task.lastStatusChange);
      elapsedSeconds = Math.floor((now.getTime() - lastChange.getTime()) / 1000);
    } else if (task.createdAt) {
      const created = task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
      elapsedSeconds = Math.floor((now.getTime() - created.getTime()) / 1000);
    }
    
    const currentDurations = task.statusDurations || {};
    const updatedDurations = {
      ...currentDurations,
      [prevStatus]: (currentDurations[prevStatus] || 0) + elapsedSeconds
    };

    data.lastStatusChange = now;
    data.statusDurations = updatedDurations;
  }

  if (status === "ON_HOLD") data.holdReason = holdReason;
  if (status === "CLOSED") data.completedAt = new Date();
  if (status !== "ON_HOLD") data.holdReason = null;
  if (status === "REOPENED") {
    data.rejectionReason = rejectionReason;
    data.rejectedAt = new Date();
    data.reworkCount = FieldValue.increment(1);
  }

  await adminDb.collection("Task").doc(taskId).update(data);
  
  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: status === "REOPENED" ? "task.reject" : "task.move",
    entity: "Task",
    entityId: taskId,
    detail: status === "REOPENED" 
      ? rejectionReason ?? "" 
      : autoRouted 
        ? "PENDING_REVIEW (auto-routed for manager review)" 
        : status + (holdReason ? ` (${holdReason})` : ""),
    createdAt: new Date(),
  });

  // Review & task status notification dispatch
  try {
    if (status === "REOPENED" && task.assigneeId) {
      await sendNotification({
        recipientId: task.assigneeId,
        actorId: user.id,
        actorName: user.name || "Manager",
        taskId,
        taskTitle: task.title,
        type: "REVIEW_REJECTED",
        title: "Task Rework Required",
        message: `${user.name || "Manager"}: "${rejectionReason || "Please make corrections"}"`,
        href: `/task/${taskId}`,
      });
    } else if (status === "PENDING_REVIEW") {
      const targetReviewerId = task.reviewerId || task.creatorId;
      if (targetReviewerId && targetReviewerId !== user.id) {
        await sendNotification({
          recipientId: targetReviewerId,
          actorId: user.id,
          actorName: user.name || "Team Member",
          taskId,
          taskTitle: task.title,
          type: "REVIEW_REQUESTED",
          title: "Ready for Review",
          message: `${user.name || "Colleague"} submitted "${task.title}" for review.`,
          href: `/task/${taskId}`,
        });
      }
    } else if (status === "CLOSED" && task.assigneeId && task.assigneeId !== user.id) {
      await sendNotification({
        recipientId: task.assigneeId,
        actorId: user.id,
        actorName: user.name || "Manager",
        taskId,
        taskTitle: task.title,
        type: "REVIEW_APPROVED",
        title: "Task Approved & Closed",
        message: `${user.name || "Manager"} approved and closed "${task.title}".`,
        href: `/task/${taskId}`,
      });
    }
  } catch (notifErr) {
    console.error("[moveTask] Notification error:", notifErr);
  }

  revalidatePath("/board");
  revalidatePath("/team");
  revalidatePath("/delegated");
  revalidatePath("/");
  revalidatePath(`/task/${taskId}`);
  return { ok: true };
}

export async function softDeleteTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const taskId = String(formData.get("taskId") || "");
  if (!taskId) return;
  
  const taskDoc = await adminDb.collection("Task").doc(taskId).get();
  if (!taskDoc.exists) return;
  const task = taskDoc.data()!;

  const allowed = task.creatorId === user.id || task.assigneeId === user.id || isManagerLike(user.systemRole);
  if (!allowed) return;

  await adminDb.collection("Task").doc(taskId).update({ deletedAt: new Date(), updatedAt: new Date() });
  
  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.delete",
    entity: "Task",
    entityId: taskId,
    detail: task.title,
    createdAt: new Date(),
  });

  revalidatePath("/board");
  revalidatePath("/deleted");
  revalidatePath("/delegated");
  revalidatePath(`/task/${taskId}`);
  if (task.groupId) revalidatePath(`/groups/${task.groupId}`);
}

export async function restoreTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const taskId = String(formData.get("taskId") || "");
  if (!taskId) return;
  
  const taskDoc = await adminDb.collection("Task").doc(taskId).get();
  if (!taskDoc.exists) return;
  const task = taskDoc.data()!;

  const allowed = task.creatorId === user.id || task.assigneeId === user.id || isManagerLike(user.systemRole);
  if (!allowed) return;

  await adminDb.collection("Task").doc(taskId).update({ deletedAt: null, updatedAt: new Date() });
  
  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.restore",
    entity: "Task",
    entityId: taskId,
    detail: task.title,
    createdAt: new Date(),
  });

  revalidatePath("/board");
  revalidatePath("/deleted");
  revalidatePath("/delegated");
}

export async function toggleWatch(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const taskId = String(formData.get("taskId") || "");
  if (!taskId) return;

  const existingSnap = await adminDb.collection("TaskWatcher")
    .where("taskId", "==", taskId)
    .where("employeeId", "==", user.id)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    await adminDb.collection("TaskWatcher").doc(existingSnap.docs[0].id).delete();
  } else {
    await adminDb.collection("TaskWatcher").add({
      taskId,
      employeeId: user.id,
      notified: true,
      createdAt: new Date(),
    });
  }
  
  revalidatePath(`/task/${taskId}`);
  revalidatePath("/subscribed");
}

export async function dismissWatcherNotification(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await adminDb.collection("TaskWatcher").doc(id).update({ notified: true });
}

export async function scoreTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const taskId = String(formData.get("taskId") || "");
  const rawScore = formData.get("score");
  const feedback = String(formData.get("feedback") || "").trim() || null;
  const autoClose = formData.get("autoClose") === "true" || formData.get("autoClose") === "on";

  if (!taskId || rawScore == null || rawScore === "") {
    return { error: "Score is required." };
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(rawScore))));
  if (isNaN(score)) return { error: "Invalid score value." };

  const taskDoc = await adminDb.collection("Task").doc(taskId).get();
  if (!taskDoc.exists) return { error: "Task not found." };
  const task = taskDoc.data()!;

  // Verify authorization: User must be a manager AND (in loop OR review needed)
  const isManager = isManagerLike(user.systemRole, (user as any).systemRoleObj);
  if (!isManager) {
    return { error: "Only managers can score tasks." };
  }

  // Check if user is in loop (TaskWatcher)
  const watcherSnap = await adminDb.collection("TaskWatcher")
    .where("taskId", "==", taskId)
    .where("employeeId", "==", user.id)
    .limit(1)
    .get();
  const inLoop = !watcherSnap.empty;

  // Check if review is needed
  let isAssigneeManager = false;
  if (task.assigneeId) {
    const assigneeDoc = await adminDb.collection("Employee").doc(task.assigneeId).get();
    if (assigneeDoc.exists) {
      const aData = assigneeDoc.data()!;
      const reportsToIds = aData.reportsToIds || (aData.reportsToId ? [aData.reportsToId] : []);
      isAssigneeManager = reportsToIds.includes(user.id);
    }
  }
  const isDirectReviewer = task.reviewerId === user.id;
  const reviewNeeded = Boolean(task.reviewRequired && (isDirectReviewer || isAssigneeManager || isManager));

  if (!inLoop && !reviewNeeded) {
    return { error: "You can only score this task if you are in the loop or assigned as the reviewer." };
  }

  const rawQualityBonus = formData.get("qualityBonusPoints");
  const qualityBonusPoints =
    rawQualityBonus != null && rawQualityBonus !== ""
      ? Math.max(0, Math.min(50, Math.round(Number(rawQualityBonus))))
      : 0;
  const qualityBonusReason = String(formData.get("qualityBonusReason") || "").trim() || null;

  // Compute quality-based reward points breakdown
  const points = computeTaskPoints({
    sizeLabel: task.sizeLabel,
    priority: task.priority,
    urgent: task.urgent,
    important: task.important,
    qualityBonusPoints,
  });

  const now = new Date();
  const updateData: Record<string, any> = {
    managerScore: score,
    scoreFeedback: feedback,
    qualityBonusPoints: points.qualityBonus,
    qualityBonusReason,
    basePoints: points.basePoints,
    priorityMultiplier: points.multiplier,
    totalApprovedPoints: points.totalPoints,
    pointsApprovedAt: now,
    pointsApprovedById: user.id,
    pointsApprovedByName: user.name || "Manager",
    scoredAt: now,
    scoredById: user.id,
    scoredByName: user.name || "Manager",
    updatedAt: now,
  };

  // If autoClose is requested (e.g. approving from PENDING_REVIEW)
  if (autoClose && task.status !== "CLOSED") {
    updateData.status = "CLOSED";
    updateData.completedAt = now;
  }

  await adminDb.collection("Task").doc(taskId).update(updateData);

  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.score",
    entity: "Task",
    entityId: taskId,
    detail: `Scored ${score}% (${feedback ? `"${feedback}"` : "no feedback"}) + ${points.qualityBonus} bonus pts by ${user.name}${autoClose ? " (Approved & Closed)" : ""}`,
    createdAt: now,
  });

  // Review notification dispatch
  if (task.assigneeId && task.assigneeId !== user.id) {
    try {
      const isApproved = autoClose || score >= 70;
      await sendNotification({
        recipientId: task.assigneeId,
        actorId: user.id,
        actorName: user.name || "Manager",
        taskId,
        taskTitle: task.title,
        type: isApproved ? "REVIEW_APPROVED" : "REVIEW_FEEDBACK",
        title: isApproved ? `Task Approved & Scored (${score}%)` : `Review Feedback (${score}%)`,
        message: `${user.name || "Manager"} evaluated "${task.title}". ${
          points.qualityBonus > 0 ? `Awarded +${points.qualityBonus} Quality Bonus Points! ` : ""
        }${feedback ? `"${feedback}"` : ""}`,
        href: `/task/${taskId}`,
      });
    } catch (notifErr) {
      console.error("[scoreTask] Notification error:", notifErr);
    }
  }

  revalidatePath(`/task/${taskId}`);
  revalidatePath("/board");
  revalidatePath("/team");
  revalidatePath("/delegated");
  revalidatePath("/all-tasks");
  return { ok: true, score };
}
