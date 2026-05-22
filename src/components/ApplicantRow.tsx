"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RemoveApplicantButton from "@/components/RemoveApplicantButton";
import EditApplicantPanel from "@/components/EditApplicantPanel";
import StatusSelect from "@/components/StatusSelect";
import { useTranslation } from "@/lib/i18n-client";
import { type TranslationKeys } from "@/lib/i18n-translations";
import { type FaceBox, normalizeFaceBox } from "@/lib/id-extraction";

type UploadedFile = {
  path: string;
  originalName: string;
};

type ExtractedData = {
  fullNameEn?: string;
  fullNameTh?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  address?: string;
} | null;

export default function ApplicantRow({
  applicantId,
  when,
  canRemove,
  canEdit,
  description,
  faceImage,
  idFaceBox,
  fallbackFaceSource,
  extractedData,
  image,
  idCard,
  pdf,
  applicationImages,
  status = "pending",
}: {
  applicantId: string;
  when: string;
  canRemove: boolean;
  canEdit: boolean;
  description: string;
  faceImage: string | null;
  idFaceBox: FaceBox | null;
  fallbackFaceSource: string | null;
  extractedData?: ExtractedData;
  image?: UploadedFile;
  idCard?: UploadedFile;
  pdf?: UploadedFile;
  applicationImages?: UploadedFile[];
  status?: "pending" | "reviewing" | "done";
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<"pending" | "reviewing" | "done">(status);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Close lightbox on ESC
  useEffect(() => {
    if (!lightboxSrc) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxSrc]);

  const handleStatusChange = async (nextStatus: "pending" | "reviewing" | "done") => {
    const previousStatus = currentStatus;
    // Optimistic update
    setCurrentStatus(nextStatus);
    setUpdatingStatus(true);

    try {
      const res = await fetch(`/api/applicants/${applicantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        alert(errData?.error ?? "Failed to update status");
        setCurrentStatus(previousStatus);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
      setCurrentStatus(previousStatus);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const name = extractedData?.fullNameTh || extractedData?.fullNameEn || null;
  const normalizedFaceBox = idFaceBox ? normalizeFaceBox(idFaceBox) : null;
  const applicationPageCount = applicationImages?.length ?? 0;
  const hasDetails = Boolean(
    description ||
    applicationPageCount > 0 ||
    extractedData?.fullNameTh ||
    extractedData?.fullNameEn ||
    extractedData?.dateOfBirth ||
    extractedData?.gender ||
    extractedData?.nationality ||
    extractedData?.address
  );
  const buildFileUrl = (kind: "image" | "idCard" | "pdf" | "applicationImage", index?: number) => {
    const params = new URLSearchParams({ kind });
    if (typeof index === "number") {
      params.set("index", String(index));
    }
    return `/api/applicants/${applicantId}/files?${params.toString()}`;
  };

  // Best clickable image for the avatar lightbox
  const avatarLightboxSrc = faceImage ?? (image?.path ? buildFileUrl("image") : null) ?? fallbackFaceSource;

  const statusClass =
    currentStatus === "pending"
      ? "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40"
      : currentStatus === "reviewing"
      ? "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40"
      : "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40";

  return (
    <div className="bg-white dark:bg-zinc-900/50">

      {/* ── Main row ──────────────────────────────────── */}
      <div className="px-3 py-2.5 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/20 transition-colors">

        <div className="flex items-start gap-2.5">

          {/* Avatar — clickable to open lightbox */}
          <button
            type="button"
            onClick={() => avatarLightboxSrc && setLightboxSrc(avatarLightboxSrc)}
            className={`relative h-10 w-10 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 shadow-sm group ${avatarLightboxSrc ? "cursor-zoom-in" : "cursor-default"}`}
            disabled={!avatarLightboxSrc}
            title={avatarLightboxSrc ? t("viewProfile") : undefined}
          >
            {faceImage ? (
              <img src={faceImage} alt="Face" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
            ) : normalizedFaceBox && fallbackFaceSource ? (
              (() => {
                const [top, left, bottom, right] = normalizedFaceBox;
                const cropWidth = Math.max(1, right - left);
                const cropHeight = Math.max(1, bottom - top);
                return (
                  <div className="absolute inset-0 overflow-hidden">
                    <img
                      src={fallbackFaceSource}
                      alt="Face"
                      className="absolute max-w-none group-hover:scale-105 transition-transform duration-200"
                      style={{
                        top: `-${(top / cropHeight) * 100}%`,
                        left: `-${(left / cropWidth) * 100}%`,
                        width: `${(100 / cropWidth) * 100}%`,
                        height: `${(100 / cropHeight) * 100}%`,
                        objectFit: "cover",
                      }}
                    />
                  </div>
                );
              })()
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            {/* Zoom hint overlay */}
            {avatarLightboxSrc && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                <svg className="h-3.5 w-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">

            {/* Row 1: name + time + (desktop: status + actions) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {name ? (
                <span className="text-sm font-semibold text-zinc-900 dark:text-white leading-tight">{name}</span>
              ) : null}
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">{when}</span>

              {/* Desktop: status + actions inline */}
              <div className="hidden md:inline-block ml-auto shrink-0">
                <StatusSelect
                  value={currentStatus}
                  labels={{ pending: t("statusPending"), reviewing: t("statusReviewing"), done: t("statusDone") }}
                  disabled={updatingStatus}
                  onChange={handleStatusChange}
                />
              </div>
              <div className="hidden md:flex items-center gap-0.5 shrink-0">
                <ActionButtons
                  open={open}
                  hasDetails={hasDetails}
                  image={image}
                  idCard={idCard}
                  pdf={pdf}
                  applicationImages={applicationImages}
                  applicationPageCount={applicationPageCount}
                  canRemove={canRemove}
                  canEdit={canEdit}
                  applicantId={applicantId}
                  buildFileUrl={buildFileUrl}
                  setOpen={setOpen}
                  editOpen={editOpen}
                  setEditOpen={setEditOpen}
                  t={t}
                />
              </div>
            </div>

            {/* Row 2: description */}
            {description ? (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate leading-tight mt-0.5">{description}</p>
            ) : null}

            {/* Row 3: tags */}
            <div className="flex flex-wrap gap-1 mt-1">
              {applicationPageCount > 0 ? (
                <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-400">
                  {applicationPageCount} {t("lblApplicationPages")}
                </span>
              ) : null}
              {extractedData?.dateOfBirth ? (
                <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-600 dark:text-zinc-400">
                  {extractedData.dateOfBirth}
                </span>
              ) : null}
              {extractedData?.gender ? (
                <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-600 dark:text-zinc-400">
                  {extractedData.gender}
                </span>
              ) : null}
              {extractedData?.nationality ? (
                <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 text-[9px] font-medium text-indigo-600 dark:text-indigo-400">
                  {extractedData.nationality}
                </span>
              ) : null}
            </div>

            {/* Row 4 (mobile only): status pill + action buttons in one tight row */}
            <div className="flex items-center gap-1.5 mt-1.5 md:hidden">
              <StatusSelect
                value={currentStatus}
                labels={{ pending: t("statusPending"), reviewing: t("statusReviewing"), done: t("statusDone") }}
                disabled={updatingStatus}
                onChange={handleStatusChange}
              />
              {/* Spacer */}
              <div className="flex-1" />
              <ActionButtons
                open={open}
                hasDetails={hasDetails}
                image={image}
                idCard={idCard}
                pdf={pdf}
                applicationImages={applicationImages}
                applicationPageCount={applicationPageCount}
                canRemove={canRemove}
                canEdit={canEdit}
                applicantId={applicantId}
                buildFileUrl={buildFileUrl}
                setOpen={setOpen}
                editOpen={editOpen}
                setEditOpen={setEditOpen}
                t={t}
              />
            </div>

          </div>
        </div>
      </div>

      {/* ── Edit panel ───────────────────────────────────────── */}
      {editOpen && (
        <EditApplicantPanel
          applicantId={applicantId}
          initialDescription={description}
          initialExtractedData={extractedData}
          initialImage={image}
          initialIdCard={idCard}
          initialPdf={pdf}
          initialApplicationImages={applicationImages}
          onClose={() => setEditOpen(false)}
        />
      )}

      {/* ── Expanded detail panel ──────────────────────────────── */}
      {open ? (
        <div className="border-t border-zinc-100 dark:border-zinc-800/60 px-4 py-4 bg-zinc-50/50 dark:bg-zinc-950/20 space-y-4">
          {extractedData ? (
            <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label={t("fullNameTh")} value={extractedData.fullNameTh} />
                <DetailItem label={t("fullNameEn")} value={extractedData.fullNameEn} />
                <DetailItem label={t("dob")} value={extractedData.dateOfBirth} />
                <DetailItem label={t("gender")} value={extractedData.gender} />
                <DetailItem label={t("nationality")} value={extractedData.nationality} />
                <DetailItem label={t("address")} value={extractedData.address} full />
              </div>
            </div>
          ) : null}

          {description ? (
            <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {t("lblDescription")}
              </p>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                {description}
              </p>
            </div>
          ) : null}

          {applicationImages && applicationImages.length > 0 ? (
            <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/50 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {t("lblApplicationPages")}
                </p>
                <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
                  {applicationPageCount}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {applicationImages.map((file, index) => (
                  <Link
                    key={file.path}
                    href={buildFileUrl("applicationImage", index)}
                    target="_blank"
                    className="group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 aspect-[3/4]"
                  >
                    <img
                      src={buildFileUrl("applicationImage", index)}
                      alt={`${t("pageLabel")} ${index + 1}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-2 py-2 text-white">
                      <span className="text-[10px] font-semibold">
                        {t("pageLabel")} {index + 1}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Face image lightbox ─────────────────────────── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
        >
          {/* Image — stop propagation so clicking image doesn't close */}
          <div
            className="relative max-w-[92vw] max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxSrc}
              alt="Profile"
              className="max-w-full max-h-[88vh] rounded-2xl shadow-2xl object-contain"
            />
            {/* Close button */}
            <button
              type="button"
              onClick={() => setLightboxSrc(null)}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared action buttons sub-component ────────────────────────────
function ActionButtons({
  open,
  hasDetails,
  image,
  idCard,
  pdf,
  applicationImages,
  applicationPageCount,
  canRemove,
  canEdit,
  applicantId,
  buildFileUrl,
  setOpen,
  editOpen,
  setEditOpen,
  t,
}: {
  open: boolean;
  hasDetails: boolean;
  image?: UploadedFile;
  idCard?: UploadedFile;
  pdf?: UploadedFile;
  applicationImages?: UploadedFile[];
  applicationPageCount: number;
  canRemove: boolean;
  canEdit: boolean;
  applicantId: string;
  buildFileUrl: (kind: "image" | "idCard" | "pdf" | "applicationImage", index?: number) => string;
  setOpen: (v: boolean | ((c: boolean) => boolean)) => void;
  editOpen: boolean;
  setEditOpen: (v: boolean) => void;
  t: (key: TranslationKeys) => string;
}) {
  return (
    <>
      {hasDetails ? (
        <button
          type="button"
          onClick={() => setOpen((c) => !c)}
          title={open ? t("hideProfile") : t("viewProfile")}
          className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : null}

      {image?.path ? (
        <Link
          href={buildFileUrl("image")}
          target="_blank"
          title={t("btnPhoto")}
          className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </Link>
      ) : null}

      {idCard?.path ? (
        <Link
          href={buildFileUrl("idCard")}
          target="_blank"
          title={t("btnIdCard")}
          className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.333 0 4 .667 4 2v1H5v-1c0-1.333 2.667-2 4-2z" />
          </svg>
        </Link>
      ) : null}

      {pdf?.path ? (
        <Link
          href={buildFileUrl("pdf")}
          target="_blank"
          title={t("btnPdfDoc")}
          className="rounded-lg p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </Link>
      ) : null}

      {applicationImages?.[0]?.path ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={`${t("lblApplicationPages")} (${applicationPageCount})`}
          className="rounded-lg p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:text-emerald-300 dark:hover:bg-emerald-950/30 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7a2 2 0 012-2h3l1-1h4l1 1h3a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7zm4 6h8m-4-4v8" />
          </svg>
        </button>
      ) : null}

      {canRemove ? <RemoveApplicantButton applicantId={applicantId} /> : null}

      {/* Edit button — admin only */}
      {canEdit ? (
        <button
          type="button"
          onClick={() => setEditOpen(!editOpen)}
          title={t("btnEdit")}
          className={`rounded-lg p-1.5 transition-colors ${
            editOpen
              ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400"
              : "text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/40"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      ) : null}
    </>
  );
}

function DetailItem({
  label,
  value,
  full = false,
}: {
  label: string;
  value?: string;
  full?: boolean;
}) {
  if (!value) return null;

  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 break-words">
        {value}
      </p>
    </div>
  );
}
