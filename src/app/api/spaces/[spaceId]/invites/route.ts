import { authOptions } from "@/lib/auth";
import { mongoClientPromise } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { spaceId } = await params;
  if (!ObjectId.isValid(spaceId)) {
    return NextResponse.json({ error: "Invalid space id" }, { status: 400 });
  }
  const spaceObjectId = new ObjectId(spaceId);

  const client = await mongoClientPromise;
  const db = client.db();

  // Only space admin can create invites
  const membership = await db.collection("space_members").findOne<{ role: "admin" | "member" }>({
    spaceId: spaceObjectId,
    userId: session.user.id,
  });
  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { role?: "admin" | "member"; expiresInDays?: number }
    | null;

  const role = body?.role ?? "member";
  const expiresInDays =
    typeof body?.expiresInDays === "number" && body.expiresInDays > 0 ? body.expiresInDays : 14;

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await db.collection("space_invites").insertOne({
    token,
    spaceId: spaceObjectId,
    role,
    createdAt: new Date(),
    createdBy: session.user.id,
    expiresAt,
  });

  return NextResponse.json({ ok: true, token, role, expiresAt });
}

