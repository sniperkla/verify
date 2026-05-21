import { authOptions } from "@/lib/auth";
import { mongoClientPromise } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

type ApplicantFile = {
  path?: string;
  originalName?: string;
};

type ApplicantRecord = {
  _id: ObjectId;
  userId?: string | null;
  spaceId?: ObjectId | null;
  createdBy: string;
  files?: {
    image?: ApplicantFile;
    idCard?: ApplicantFile;
    pdf?: ApplicantFile;
    applicationImages?: ApplicantFile[];
  };
};

function guessContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function normalizeUploadPath(relativePath: string) {
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const normalizedRelativePath = path.posix.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolutePath = path.resolve(uploadsRoot, normalizedRelativePath);

  if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw new Error("Invalid upload path.");
  }

  return { absolutePath, normalizedRelativePath };
}

async function canAccessApplicant(applicant: ApplicantRecord, userId: string) {
  if (applicant.userId) {
    return applicant.userId === userId;
  }

  if (!applicant.spaceId) {
    return false;
  }

  const client = await mongoClientPromise();
  const db = client.db();
  const membership = await db.collection("space_members").findOne({
    spaceId: applicant.spaceId,
    userId,
  });

  return Boolean(membership);
}

function selectApplicantFile(
  applicant: ApplicantRecord,
  kind: string,
  index: number
): ApplicantFile | null {
  if (kind === "image") return applicant.files?.image ?? null;
  if (kind === "idCard") return applicant.files?.idCard ?? null;
  if (kind === "pdf") return applicant.files?.pdf ?? null;
  if (kind === "applicationImage") return applicant.files?.applicationImages?.[index] ?? null;
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ applicantId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { applicantId } = await params;
  if (!ObjectId.isValid(applicantId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "";
  const indexRaw = searchParams.get("index");
  const index = indexRaw ? Number(indexRaw) : 0;

  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const client = await mongoClientPromise();
  const db = client.db();
  const applicant = await db.collection<ApplicantRecord>("applicants").findOne({
    _id: new ObjectId(applicantId),
  });

  if (!applicant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authorized = await canAccessApplicant(applicant, session.user.id);
  if (!authorized) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const selectedFile = selectApplicantFile(applicant, kind, index);
  if (!selectedFile?.path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let absolutePath: string;
  try {
    absolutePath = normalizeUploadPath(selectedFile.path).absolutePath;
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await fs.readFile(absolutePath).catch(() => null);
  if (!buffer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = selectedFile.originalName || path.basename(absolutePath);

  return new Response(buffer, {
    headers: {
      "Content-Type": guessContentType(absolutePath),
      "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
