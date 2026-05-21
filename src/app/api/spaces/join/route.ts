import { authOptions } from "@/lib/auth";
import { mongoClientPromise } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim();
  if (!code) return NextResponse.json({ error: "Invite code is required" }, { status: 400 });

  const client = await mongoClientPromise;
  const db = client.db();

  const invite = await db.collection("space_invites").findOne<{
    _id: unknown;
    token: string;
    spaceId: ObjectId;
    role?: "admin" | "member";
    expiresAt?: Date;
    usedAt?: Date;
  }>({ token: code });

  if (!invite || invite.usedAt) {
    return NextResponse.json({ error: "Invalid or already used invite code." }, { status: 400 });
  }
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invite code expired." }, { status: 400 });
  }

  const role = invite.role ?? "member";

  // Add membership if not exists
  await db.collection("space_members").updateOne(
    { spaceId: invite.spaceId, userId: session.user.id },
    { $setOnInsert: { spaceId: invite.spaceId, userId: session.user.id, role, createdAt: new Date() } },
    { upsert: true }
  );

  // Mark invite used
  await db.collection("space_invites").updateOne(
    { token: code, usedAt: { $exists: false } },
    { $set: { usedAt: new Date(), usedBy: session.user.id } }
  );

  return NextResponse.json({ ok: true, spaceId: String(invite.spaceId) });
}

