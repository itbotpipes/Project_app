import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadTaskDetailData } from "@/lib/taskDetail";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const data = await loadTaskDetailData(id, user);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data);
}
