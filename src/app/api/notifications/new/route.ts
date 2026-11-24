import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ notifications: [] });
  }

  try {
    const snap = await adminDb
      .collection("Notification")
      .where("recipientId", "==", user.id)
      .where("read", "==", false)
      .limit(30)
      .get();

    const notifications = snap.docs
      .map((d) => {
        const data = d.data();
        const dateObj = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
        return {
          id: d.id,
          taskId: data.taskId,
          taskTitle: data.taskTitle,
          type: data.type,
          title: data.title,
          message: data.message,
          actorName: data.actorName,
          href: data.href || `/task/${data.taskId}`,
          notified: Boolean(data.notified),
          createdAt: dateObj.toISOString(),
          timeMs: dateObj.getTime(),
        };
      })
      .sort((a, b) => b.timeMs - a.timeMs)
      .slice(0, 10);

    return NextResponse.json({ notifications });
  } catch (err) {
    console.error("[api/notifications/new] Error:", err);
    return NextResponse.json({ notifications: [] });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    if (action === "read" || action === "dismiss") {
      await adminDb.collection("Notification").doc(id).update({
        read: true,
        notified: true,
        updatedAt: new Date(),
      });
    } else if (action === "notified") {
      await adminDb.collection("Notification").doc(id).update({
        notified: true,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/notifications/new POST] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
