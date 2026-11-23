import "server-only";
import { adminDb } from "./firebase/admin";

export type NotificationType =
  | "REVIEW_APPROVED"
  | "REVIEW_REJECTED"
  | "REVIEW_SCORED"
  | "REVIEW_FEEDBACK"
  | "REVIEW_REQUESTED"
  | "TASK_COMMENT";

export interface TaskNotification {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  taskId: string;
  taskTitle: string;
  type: NotificationType;
  title: string;
  message: string;
  href: string;
  read: boolean;
  notified: boolean;
  createdAt: Date;
}

/**
 * Sends a notification to a specific recipient, preventing self-notifications
 * and recent duplicate spam.
 */
export async function sendNotification(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  taskId: string;
  taskTitle: string;
  type: NotificationType;
  title: string;
  message: string;
  href?: string;
}): Promise<string | null> {
  const { recipientId, actorId, actorName, taskId, taskTitle, type, title, message } = params;

  // Never notify self
  if (!recipientId || recipientId === actorId) {
    return null;
  }

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  // Check for recent duplicate within 1 minute
  try {
    const recentDuplicate = await adminDb
      .collection("Notification")
      .where("recipientId", "==", recipientId)
      .where("taskId", "==", taskId)
      .where("type", "==", type)
      .where("createdAt", ">=", oneMinuteAgo)
      .limit(1)
      .get();

    if (!recentDuplicate.empty) {
      return recentDuplicate.docs[0].id;
    }

    const href = params.href || `/task/${taskId}`;

    const docRef = await adminDb.collection("Notification").add({
      recipientId,
      actorId,
      actorName: actorName || "Colleague",
      taskId,
      taskTitle: taskTitle || "Task",
      type,
      title,
      message,
      href,
      read: false,
      notified: false,
      createdAt: now,
    });

    return docRef.id;
  } catch (err) {
    console.error("[sendNotification] Failed to create notification:", err);
    return null;
  }
}

/**
 * Get unread notifications for a user, sorted descending by date.
 */
export async function getUnreadNotifications(userId: string, limitCount = 20): Promise<TaskNotification[]> {
  if (!userId) return [];
  try {
    const snap = await adminDb
      .collection("Notification")
      .where("recipientId", "==", userId)
      .where("read", "==", false)
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();

    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        recipientId: data.recipientId,
        actorId: data.actorId,
        actorName: data.actorName || "Colleague",
        taskId: data.taskId,
        taskTitle: data.taskTitle || "Task",
        type: data.type,
        title: data.title || "Notification",
        message: data.message || "",
        href: data.href || `/task/${data.taskId}`,
        read: Boolean(data.read),
        notified: Boolean(data.notified),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
      };
    });
  } catch (err) {
    console.error("[getUnreadNotifications] Error:", err);
    return [];
  }
}

/**
 * Mark a notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  if (!notificationId) return false;
  try {
    await adminDb.collection("Notification").doc(notificationId).update({
      read: true,
      updatedAt: new Date(),
    });
    return true;
  } catch (err) {
    console.error("[markNotificationAsRead] Error:", err);
    return false;
  }
}

/**
 * Mark a notification as toasted/notified on client.
 */
export async function markNotificationAsNotified(notificationId: string): Promise<boolean> {
  if (!notificationId) return false;
  try {
    await adminDb.collection("Notification").doc(notificationId).update({
      notified: true,
    });
    return true;
  } catch (err) {
    console.error("[markNotificationAsNotified] Error:", err);
    return false;
  }
}
