import { authOptions } from "@/lib/auth";
import { mongoClientPromise } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function guessContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const p = (await params).path ?? [];
  if (p.length < 2) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Prevent path traversal
  const relPosix = path.posix.normalize(p.join("/")).replace(/^(\.\.(\/|\\|$))+/, "");
  const parts = relPosix.split("/");

  // Supported layouts:
  // - users/{userId}/{filename}
  // - spaces/{spaceId}/{filename}
  const scope = parts[0];
  const scopeId = parts[1];
  if (!scope || !scopeId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (scope === "users") {
    if (scopeId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!relPosix.startsWith(`users/${scopeId}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (scope === "spaces") {
    if (!ObjectId.isValid(scopeId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const client = await mongoClientPromise;
    const db = client.db();
    const membership = await db.collection("space_members").findOne({
      spaceId: new ObjectId(scopeId),
      userId: session.user.id,
    });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!relPosix.startsWith(`spaces/${scopeId}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const abs = path.join(process.cwd(), "uploads", relPosix);
  const buf = await fs.readFile(abs).catch(() => null);
  if (!buf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new Response(buf, {
    headers: {
      "Content-Type": guessContentType(abs),
      "Content-Disposition": `inline; filename="${path.basename(abs)}"`,
    },
  });
}
