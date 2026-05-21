import { authOptions } from "@/lib/auth";
import { mongoClientPromise } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { ObjectId } from "mongodb";
import { normalizeExtractedIdData } from "@/lib/id-extraction";

export const runtime = "nodejs";

function sanitizeFilename(name: string) {
  // keep it simple: remove path separators and weird chars
  return name.replace(/[^\w.\-]+/g, "_");
}

async function saveUploadedFile(scopeDir: string, file: File) {
  const uploadsRoot = path.join(process.cwd(), "uploads");
  const absDir = path.join(uploadsRoot, scopeDir);
  await fs.mkdir(absDir, { recursive: true });

  const originalName = file.name || "upload.bin";
  const safeName = `${Date.now()}_${sanitizeFilename(originalName)}`;
  const relPath = `${scopeDir}/${safeName}`;
  const absPath = path.join(uploadsRoot, relPath);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buf);

  return {
    path: relPath,
    originalName,
    mime: file.type || "application/octet-stream",
    size: file.size,
  };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const description = String(form.get("description") ?? "");
  const spaceId = String(form.get("spaceId") ?? "personal"); // "personal" or ObjectId string

  const image = form.get("image");
  const idCard = form.get("idCard");
  const applicationImages = form
    .getAll("applicationImages")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const pdf = form.get("pdf");

  const client = await mongoClientPromise;
  const db = client.db();

  // Authorization for space submissions
  let spaceObjectId: ObjectId | null = null;
  let ownerUserId: string | null = session.user.id;

  let uploadScopeDir = `users/${session.user.id}`;

  if (spaceId !== "personal") {
    if (!ObjectId.isValid(spaceId)) {
      return NextResponse.json({ error: "Invalid spaceId" }, { status: 400 });
    }
    spaceObjectId = new ObjectId(spaceId);
    ownerUserId = null;
    uploadScopeDir = `spaces/${spaceId}`;

    const membership = await db.collection("space_members").findOne({
      spaceId: spaceObjectId,
      userId: session.user.id,
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const files: Record<string, unknown> = {};
  if (image instanceof File && image.size > 0) files.image = await saveUploadedFile(uploadScopeDir, image);
  if (idCard instanceof File && idCard.size > 0) files.idCard = await saveUploadedFile(uploadScopeDir, idCard);
  if (applicationImages.length > 0) {
    files.applicationImages = await Promise.all(
      applicationImages.map((file) => saveUploadedFile(uploadScopeDir, file))
    );
  }
  if (pdf instanceof File && pdf.size > 0) files.pdf = await saveUploadedFile(uploadScopeDir, pdf);

  if (!files.image && !files.idCard && !files.applicationImages && !files.pdf && !description.trim()) {
    return NextResponse.json(
      { error: "Provide at least a description or one file." },
      { status: 400 }
    );
  }

  const extractedDataRaw = form.get("extractedData");
  let extractedData = null;
  if (extractedDataRaw) {
    try {
      extractedData = normalizeExtractedIdData(JSON.parse(String(extractedDataRaw)));
    } catch (e) {
      console.error("Failed to parse extractedData:", e);
    }
  }

  const result = await db.collection("applicants").insertOne({
    userId: ownerUserId, // personal owner; null for team/space records
    spaceId: spaceObjectId, // null for personal
    createdBy: session.user.id,
    description,
    files,
    extractedData,
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true, id: String(result.insertedId) });
}
