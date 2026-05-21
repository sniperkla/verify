import { authOptions } from "@/lib/auth";
import { mongoClientPromise } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await mongoClientPromise;
  const db = client.db();

  const memberships = await db
    .collection<{ spaceId: ObjectId; userId: string; role: "admin" | "member" }>("space_members")
    .find({ userId: session.user.id })
    .toArray();

  const spaceIds = memberships.map((m) => m.spaceId);
  const spaces =
    spaceIds.length === 0
      ? []
      : await db
          .collection<{ _id: ObjectId; name: string; createdAt: Date }>("spaces")
          .find({ _id: { $in: spaceIds } })
          .sort({ createdAt: -1 })
          .toArray();

  const roleBySpaceId = new Map(memberships.map((m) => [String(m.spaceId), m.role]));

  return NextResponse.json({
    ok: true,
    spaces: spaces.map((s) => ({
      id: String(s._id),
      name: s.name,
      role: roleBySpaceId.get(String(s._id)) ?? "member",
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: "Space name is required" }, { status: 400 });

  const client = await mongoClientPromise;
  const db = client.db();

  const createdAt = new Date();
  const spaceRes = await db.collection("spaces").insertOne({
    name,
    createdAt,
    createdBy: session.user.id,
  });

  await db.collection("space_members").insertOne({
    spaceId: spaceRes.insertedId,
    userId: session.user.id,
    role: "admin",
    createdAt,
  });

  return NextResponse.json({ ok: true, id: String(spaceRes.insertedId) });
}

