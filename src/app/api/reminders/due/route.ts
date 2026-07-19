import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ reminders: [] }, { status: 401 });

  const reminders = await prisma.reminder.findMany({
    where: { sent: false, remindAt: { lte: new Date() }, task: { assigneeId: user.id } },
    include: { task: { select: { id: true, title: true } } },
    orderBy: { remindAt: "asc" },
    take: 10,
  });

  return NextResponse.json({
    reminders: reminders.map((r) => ({
      id: r.id,
      taskId: r.task.id,
      title: r.task.title,
      remindAt: r.remindAt,
    })),
  });
}
