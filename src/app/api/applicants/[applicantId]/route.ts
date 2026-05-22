import { authOptions } from "@/lib/auth";
import { mongoClientPromise } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { ObjectId } from "mongodb";
import { normalizeExtractedIdData } from "@/lib/id-extraction";

export const dynamic = "force-dynamic";

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

function sanitizeFilename(name: string) {
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
  return { path: relPath, originalName, mime: file.type || "application/octet-stream", size: file.size };
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

  const client = await mongoClientPromise();
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

export async function PATCH(
  req: Request,
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

  const client = await mongoClientPromise();
  const db = client.db();
  const applicantObjectId = new ObjectId(applicantId);

  const applicant = await db.collection<ApplicantRecord>("applicants").findOne({
    _id: applicantObjectId,
  });

  if (!applicant) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  let canUpdate = false;
  if (applicant.userId) {
    canUpdate = applicant.userId === session.user.id;
  } else if (applicant.spaceId) {
    const membership = await db.collection("space_members").findOne({
      spaceId: applicant.spaceId,
      userId: session.user.id,
    });
    canUpdate = Boolean(membership);
  }

  if (!canUpdate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const $set: Record<string, unknown> = {};
  const filesToDelete: string[] = [];

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    // ── FormData: file replacements + optional text fields ──────────
    const form = await req.formData();

    const descriptionField = form.get("description");
    if (descriptionField !== null) $set.description = String(descriptionField);

    const extractedDataRaw = form.get("extractedData");
    if (extractedDataRaw) {
      try {
        $set.extractedData = normalizeExtractedIdData(JSON.parse(String(extractedDataRaw)));
      } catch { /* ignore parse errors */ }
    }

    // Determine upload scope dir from existing applicant
    const uploadScopeDir = applicant.spaceId
      ? `spaces/${String(applicant.spaceId)}`
      : `users/${applicant.userId ?? session.user.id}`;

    const imageFile = form.get("image");
    if (imageFile instanceof File && imageFile.size > 0) {
      const saved = await saveUploadedFile(uploadScopeDir, imageFile);
      if (applicant.files?.image?.path) filesToDelete.push(applicant.files.image.path);
      $set["files.image"] = saved;
    }

    const idCardFile = form.get("idCard");
    if (idCardFile instanceof File && idCardFile.size > 0) {
      const saved = await saveUploadedFile(uploadScopeDir, idCardFile);
      if (applicant.files?.idCard?.path) filesToDelete.push(applicant.files.idCard.path);
      $set["files.idCard"] = saved;
    }

    const pdfFile = form.get("pdf");
    if (pdfFile instanceof File && pdfFile.size > 0) {
      const saved = await saveUploadedFile(uploadScopeDir, pdfFile);
      if (applicant.files?.pdf?.path) filesToDelete.push(applicant.files.pdf.path);
      $set["files.pdf"] = saved;
    }

    // ── Application images (add / remove) ────────────────────────
    const appImageIndexesRaw = form.get("applicationImageIndexesToKeep");
    const newApplicationImages = form.getAll("newApplicationImage");

    if (appImageIndexesRaw !== null || newApplicationImages.length > 0) {
      let keptIndexes: number[] = [];
      if (appImageIndexesRaw) {
        try {
          const parsed = JSON.parse(String(appImageIndexesRaw));
          if (Array.isArray(parsed)) {
            keptIndexes = parsed.filter(
              (n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0
            );
          }
        } catch { /* ignore parse errors */ }
      }

      const existingImages = applicant.files?.applicationImages ?? [];
      const keptImages: ApplicantFile[] = [];

      existingImages.forEach((img, i) => {
        if (keptIndexes.includes(i)) {
          keptImages.push(img);
        } else {
          if (img.path) filesToDelete.push(img.path);
        }
      });

      const savedNewImages: ApplicantFile[] = [];
      for (const imgFile of newApplicationImages) {
        if (imgFile instanceof File && imgFile.size > 0) {
          const saved = await saveUploadedFile(uploadScopeDir, imgFile);
          savedNewImages.push(saved);
        }
      }

      $set["files.applicationImages"] = [...keptImages, ...savedNewImages];
    }
  } else {
    // ── JSON: status / description / extractedData updates ──────────
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { status, description, extractedData } = body;

    if (status !== undefined) {
      if (!["pending", "reviewing", "done"].includes(status)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
      $set.status = status;
    }
    if (description !== undefined) $set.description = String(description);
    if (extractedData !== undefined) {
      $set.extractedData = extractedData === null
        ? null
        : normalizeExtractedIdData(extractedData);
    }
  }

  if (Object.keys($set).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updateResult = await db.collection("applicants").updateOne(
    { _id: applicantObjectId },
    { $set }
  );

  if (updateResult.matchedCount !== 1) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  // Clean up old files that were replaced
  if (filesToDelete.length > 0) {
    await Promise.allSettled(filesToDelete.map(deleteUploadedFile));
  }

  return NextResponse.json({ ok: true });
}
