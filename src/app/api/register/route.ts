import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { mongoClientPromise } from "@/lib/mongodb";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = body?.username?.trim();
  const password = body?.password;

  if (!username || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Username required and password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const client = await mongoClientPromise;
  const db = client.db();
  const users = db.collection("users");

  const existing = await users.findOne({ username });
  if (existing) {
    return NextResponse.json({ error: "Username already exists." }, { status: 409 });
  }

  // Bootstrap: if there are no users yet, make the first account admin.
  const userCount = await users.countDocuments({});
  const role: "admin" | "member" = userCount === 0 ? "admin" : "member";

  const passwordHash = await hash(password, 12);
  const result = await users.insertOne({
    username,
    passwordHash,
    role,
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true, userId: String(result.insertedId), role });
}
