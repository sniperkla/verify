"use client";

import { useState } from "react";
import Link from "next/link";
import RemoveApplicantButton from "@/components/RemoveApplicantButton";
import { useTranslation } from "@/lib/i18n-client";
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
  description,
  faceImage,
  idFaceBox,
  fallbackFaceSource,
  extractedData,
  image,
  idCard,
  pdf,
  applicationImages,
}: {
  applicantId: string;
  when: string;
  canRemove: boolean;
  description: string;
  faceImage: string | null;
  idFaceBox: FaceBox | null;
  fallbackFaceSource: string | null;
  extractedData?: ExtractedData;
  image?: UploadedFile;
  idCard?: UploadedFile;
  pdf?: UploadedFile;
  applicationImages?: UploadedFile[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

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

  return (
    <div className="bg-white dark:bg-zinc-900/50">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
        <div className="relative h-11 w-11 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 shadow-sm">
          {faceImage ? (
            <img src={faceImage} alt="Face" className="h-full w-full object-cover" />
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
                    className="absolute max-w-none"
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
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            {name ? (
              <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{name}</span>
            ) : null}
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 shrink-0">{when}</span>
          </div>

          {description ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{description}</p>
          ) : null}

          <div className="flex flex-wrap gap-1 mt-1">
            {applicationPageCount > 0 ? (
              <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                {applicationPageCount} {t("lblApplicationPages")}
              </span>
            ) : null}
            {extractedData?.dateOfBirth ? (
              <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                {extractedData.dateOfBirth}
              </span>
            ) : null}
            {extractedData?.gender ? (
              <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                {extractedData.gender}
              </span>
            ) : null}
            {extractedData?.nationality ? (
              <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                {extractedData.nationality}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {hasDetails ? (
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
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
        </div>
      </div>

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
    </div>
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
