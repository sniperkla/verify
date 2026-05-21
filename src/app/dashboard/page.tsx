import { authOptions } from "@/lib/auth";
import { mongoClientPromise } from "@/lib/mongodb";
import ApplicantRow from "@/components/ApplicantRow";
import CollapsibleForm from "@/components/CollapsibleForm";
import WorkspaceBar from "@/components/WorkspaceBar";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
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
  searchParams?: Promise<{ space?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const user = session.user;

  const t = await getTranslationsServer();

  const client = await mongoClientPromise();
  const db = client.db();

  // Await searchParams as required by Next.js 15+
  const resolvedSearchParams = await searchParams;
  let currentSpace = resolvedSearchParams?.space?.trim() || "personal";
  let currentSpaceObjectId: ObjectId | null = null;
  let currentSpaceRole: "admin" | "member" | null = null;

  if (currentSpace !== "personal") {
    if (!ObjectId.isValid(currentSpace)) {
      currentSpace = "personal";
    } else {
      const oid = new ObjectId(currentSpace);
      const membership = await db.collection<{ role: "admin" | "member" }>("space_members").findOne({
        spaceId: oid,
        userId: user.id,
      });
      if (!membership) {
        currentSpace = "personal";
      } else {
        currentSpaceObjectId = oid;
        currentSpaceRole = membership.role;
      }
    }
  }

  const filter =
    currentSpace === "personal"
      ? { userId: user.id }
      : { spaceId: currentSpaceObjectId };

  // Fetch applicant submissions
  const applicants = await db
    .collection<ApplicantDoc>("applicants")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  // Fetch metadata counts for metric stats
  const personalSubmissionsCount = await db.collection("applicants").countDocuments({ userId: user.id });
  let spaceSubmissionsCount = 0;
  let activeSpaceName = currentSpace === "personal" ? t("personalWorkspace") : "Personal Workspace";

  if (currentSpaceObjectId) {
    spaceSubmissionsCount = await db.collection("applicants").countDocuments({ spaceId: currentSpaceObjectId });
    const spaceData = await db.collection("spaces").findOne({ _id: currentSpaceObjectId });
    if (spaceData) {
      activeSpaceName = spaceData.name;
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 space-y-4">
      {/* Compact header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white truncate">
            {activeSpaceName}
          </h1>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            {personalSubmissionsCount} {t("personalSubmissions")}
            {currentSpace !== "personal" && spaceSubmissionsCount > 0 && (
              <> · {spaceSubmissionsCount} {t("activeSpaceSubmissions")}</>
            )}
          </p>
        </div>
      </div>

      {/* Workspace Manager */}
      <WorkspaceBar currentSpace={currentSpace} />

      {/* Submission Form */}
      <CollapsibleForm spaceId={currentSpace} />

      {/* Submissions List */}
      <section className="space-y-2">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white">{t("recentSubmissions")}</h2>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/20">
            {currentSpace === "personal" ? t("personalScope") : t("spaceScope")}
          </span>
        </div>

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
              const canRemove =
                currentSpace === "personal" || a.createdBy === user.id || currentSpaceRole === "admin";

              // Best face to show: prefer applicant selfie, fall back to ID card face
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
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
