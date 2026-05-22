import { authOptions } from "@/lib/auth";
import { mongoClientPromise } from "@/lib/mongodb";
import ApplicantRow from "@/components/ApplicantRow";
import CollapsibleForm from "@/components/CollapsibleForm";
import WorkspaceBar from "@/components/WorkspaceBar";
import SubmissionsContainer from "@/components/SubmissionsContainer";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { getTranslationsServer } from "@/lib/i18n-server";
import { type FaceBox, normalizeFaceBox } from "@/lib/id-extraction";

export const dynamic = "force-dynamic";

type ApplicantDoc = {
  _id: unknown;
  userId?: string | null;
  spaceId?: ObjectId | null;
  createdBy: string;
  description: string;
  status?: "pending" | "reviewing" | "done";
  createdAt: Date;
  files?: {
    image?: { path: string; originalName: string };
    idCard?: { path: string; originalName: string };
    applicationImages?: { path: string; originalName: string }[];
    pdf?: { path: string; originalName: string };
  };
  extractedData?: {
    fullNameEn?: string;
    fullNameTh?: string;
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
    address?: string;
    croppedFace?: string;
    faceBox?: FaceBox;
    applicantCroppedFace?: string;
    applicantFaceBox?: FaceBox;
  } | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ space?: string; status?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const user = session.user;

  const t = await getTranslationsServer();

  const client = await mongoClientPromise();
  const db = client.db();

  // Resolve space param
  const resolvedSearchParams = await searchParams;
  const spaceParam = resolvedSearchParams?.space?.trim();
  const statusParam = resolvedSearchParams?.status?.trim() || "";

  // Load user memberships to find valid spaces
  const memberships = await db
    .collection<{ spaceId: ObjectId; userId: string; role: "admin" | "member" }>("space_members")
    .find({ userId: user.id })
    .toArray();

  // If user has no spaces at all → show empty onboarding state (no redirect loop)
  const hasNoSpaces = memberships.length === 0;

  let currentSpace = "";
  let currentSpaceObjectId: ObjectId | null = null;
  let currentSpaceRole: "admin" | "member" | null = null;
  let activeSpaceName = "";

  if (!hasNoSpaces) {
    // Resolve the requested space or fall back to first
    let targetId = spaceParam && ObjectId.isValid(spaceParam) ? spaceParam : null;
    if (!targetId) {
      // Default to first membership
      targetId = String(memberships[0].spaceId);
      redirect(`/dashboard?space=${encodeURIComponent(targetId)}`);
    }

    const oid = new ObjectId(targetId);
    const membership = memberships.find((m) => String(m.spaceId) === targetId);
    if (!membership) {
      // Not a member of requested space → fall back to first
      const fallback = String(memberships[0].spaceId);
      redirect(`/dashboard?space=${encodeURIComponent(fallback)}`);
    }

    currentSpace = targetId;
    currentSpaceObjectId = oid;
    currentSpaceRole = membership!.role;

    const spaceData = await db.collection("spaces").findOne({ _id: oid });
    activeSpaceName = spaceData?.name ?? "Workspace";
  }

  // Fetch status counts in parallel
  const [
    totalCount,
    pendingCount,
    reviewingCount,
    doneCount
  ] = currentSpaceObjectId ? await Promise.all([
    db.collection("applicants").countDocuments({ spaceId: currentSpaceObjectId }),
    db.collection("applicants").countDocuments({ spaceId: currentSpaceObjectId, status: { $in: ["pending", null, undefined] } }),
    db.collection("applicants").countDocuments({ spaceId: currentSpaceObjectId, status: "reviewing" }),
    db.collection("applicants").countDocuments({ spaceId: currentSpaceObjectId, status: "done" })
  ]) : [0, 0, 0, 0];

  const filter: any = { spaceId: currentSpaceObjectId };
  if (statusParam === "pending") {
    filter.status = { $in: ["pending", null, undefined] };
  } else if (statusParam === "reviewing") {
    filter.status = "reviewing";
  } else if (statusParam === "done") {
    filter.status = "done";
  }

  // Fetch submissions for the current space (empty if no space)
  const applicants = currentSpaceObjectId
    ? await db
        .collection<ApplicantDoc>("applicants")
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray()
    : [];

  const spaceSubmissionsCount = totalCount;

  // Keep for compat — not used for personal scope anymore
  const personalSubmissionsCount = spaceSubmissionsCount;

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
      {/* Compact header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white truncate">
            {activeSpaceName || "Dashboard"}
          </h1>
          {activeSpaceName ? (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 flex flex-wrap items-center gap-x-1">
              <span>{spaceSubmissionsCount} {t("activeSpaceSubmissions")}</span>
              {currentSpaceRole && (
                <><span>·</span><span className="capitalize">{currentSpaceRole}</span></>
              )}
            </p>
          ) : null}
        </div>
      </div>

      {/* Workspace Manager */}
      <WorkspaceBar currentSpace={currentSpace} />

      {/* Empty onboarding state — no workspaces yet */}
      {hasNoSpaces ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 py-14 text-center">
          <div className="mx-auto mb-3 w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
            <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No workspace yet</p>
          <p className="mt-1 text-xs text-zinc-400">Create a workspace or join one using an invite code above.</p>
        </div>
      ) : (
        <>
          {/* Submission Form */}
          <CollapsibleForm spaceId={currentSpace} />

           {/* Submissions List */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white">{t("recentSubmissions")}</h2>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/20">
                {t("spaceScope")}
              </span>
            </div>

            <SubmissionsContainer
              currentSpace={currentSpace}
              statusParam={statusParam}
              totalCount={totalCount}
              pendingCount={pendingCount}
              reviewingCount={reviewingCount}
              doneCount={doneCount}
              t={{
                filterAll: t("filterAll"),
                statusPending: t("statusPending"),
                statusReviewing: t("statusReviewing"),
                statusDone: t("statusDone"),
              }}
            >
              {applicants.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 py-8 text-center">
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("noSubmissions")}</p>
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{t("useFormAbove")}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
                  {applicants.map((a) => {
                    const id = String(a._id);
                    const when = new Date(a.createdAt).toLocaleString(undefined, {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    });
                    const canRemove = a.createdBy === user.id || currentSpaceRole === "admin";

                    const faceImage =
                      a.extractedData?.applicantCroppedFace ||
                      a.extractedData?.croppedFace ||
                      null;

                    const idFaceBox = !faceImage ? (normalizeFaceBox(
                      a.extractedData?.applicantFaceBox ?? a.extractedData?.faceBox
                    ) ?? null) : null;

                    const ext = a.extractedData;
                    const fallbackFaceSource = a.files?.image?.path
                      ? `/api/applicants/${id}/files?kind=image`
                      : a.files?.idCard?.path
                        ? `/api/applicants/${id}/files?kind=idCard`
                        : null;

                    return (
                      <ApplicantRow
                        key={id}
                        applicantId={id}
                        when={when}
                        canRemove={canRemove}
                        description={a.description}
                        faceImage={faceImage}
                        idFaceBox={idFaceBox}
                        fallbackFaceSource={fallbackFaceSource}
                        extractedData={ext}
                        image={a.files?.image}
                        idCard={a.files?.idCard}
                        pdf={a.files?.pdf}
                        applicationImages={a.files?.applicationImages}
                        status={a.status}
                      />
                    );
                  })}
                </div>
              )}
            </SubmissionsContainer>
          </div>
        </>
      )}
    </div>
  );
}
