import { authOptions } from "@/lib/auth";
import { mongoClientPromise } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";

type ApplicantFile = { path?: string; originalName?: string };

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

function collectUploadPaths(files: ApplicantRecord["files"]) {
  return [
    files?.image?.path,
    files?.idCard?.path,
    ...(files?.applicationImages?.map((file) => file.path) ?? []),
    files?.pdf?.path,
  ].filter(
    (filePath): filePath is string => typeof filePath === "string" && filePath.length > 0
  );
}

async function deleteUploadedFile(relativePath: string) {
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const normalizedRelativePath = path.posix.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolutePath = path.resolve(uploadsRoot, normalizedRelativePath);

  if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw new Error("Invalid upload path.");
  }

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ applicantId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { applicantId } = await params;
  if (!ObjectId.isValid(applicantId)) {
    return NextResponse.json({ error: "Invalid applicant id" }, { status: 400 });
  }

  const client = await mongoClientPromise;
  const db = client.db();
  const applicantObjectId = new ObjectId(applicantId);

  const applicant = await db.collection<ApplicantRecord>("applicants").findOne({
    _id: applicantObjectId,
  });

  if (!applicant) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  let canDelete = false;

  if (applicant.userId) {
    canDelete = applicant.userId === session.user.id;
  } else if (applicant.spaceId) {
    const membership = await db.collection<{ role: "admin" | "member" }>("space_members").findOne({
      spaceId: applicant.spaceId,
      userId: session.user.id,
    });

    canDelete = Boolean(membership) && (membership?.role === "admin" || applicant.createdBy === session.user.id);
  }

  if (!canDelete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deleteResult = await db.collection("applicants").deleteOne({ _id: applicantObjectId });
  if (deleteResult.deletedCount !== 1) {
    return NextResponse.json({ error: "Failed to remove submission." }, { status: 500 });
  }

  const uploadPaths = collectUploadPaths(applicant.files);
  const fileDeletionResults = await Promise.allSettled(uploadPaths.map(deleteUploadedFile));
  const failedDeletions = fileDeletionResults.filter((result) => result.status === "rejected");

  if (failedDeletions.length > 0) {
    console.error("Submission removed but file cleanup failed:", failedDeletions);
    return NextResponse.json({
      ok: true,
      warning: "Submission removed, but some uploaded files could not be deleted.",
    });
  }

  return NextResponse.json({ ok: true });
}
