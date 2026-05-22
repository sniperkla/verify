"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n-client";

// Same compression logic as ApplicantForm — max 1920px, 0.85 JPEG quality
async function compressImage(
  file: File,
  maxPx = 1920,
  quality = 0.85
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w <= maxPx && h <= maxPx) { resolve(file); return; }
      const scale = maxPx / Math.max(w, h);
      const outW = Math.round(w * scale);
      const outH = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, outW, outH);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

type ExtractedData = {
  fullNameEn?: string;
  fullNameTh?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  address?: string;
} | null;

type UploadedFile = { path: string; originalName: string };

const FIELDS = [
  { key: "fullNameEn" as const, labelKey: "fullNameEn" as const },
  { key: "fullNameTh" as const, labelKey: "fullNameTh" as const },
  { key: "dateOfBirth" as const, labelKey: "dob" as const },
  { key: "gender" as const, labelKey: "gender" as const },
  { key: "nationality" as const, labelKey: "nationality" as const },
  { key: "address" as const, labelKey: "address" as const, full: true },
] as const;

function FileSlot({
  label,
  accept,
  currentSrc,
  currentName,
  isImage,
  file,
  preview,
  onFileChange,
}: {
  label: string;
  accept: string;
  currentSrc?: string;
  currentName?: string;
  isImage: boolean;
  file: File | null;
  preview: string | null;
  onFileChange: (f: File | null, preview: string | null) => void;
}) {
  const displaySrc = preview ?? currentSrc;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) { onFileChange(null, null); return; }
    const url = URL.createObjectURL(f);
    onFileChange(f, url);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <label className="group relative flex items-center gap-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/40 px-3 py-2.5 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors">
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleChange}
        />

        {/* Thumbnail / icon */}
        {isImage && displaySrc ? (
          <div className="relative shrink-0">
            <img
              src={displaySrc}
              alt={label}
              className="h-12 w-12 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
            />
            {file && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-indigo-600 border-2 border-white dark:border-zinc-900" />
            )}
          </div>
        ) : (
          <div className="h-12 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
            {isImage ? (
              <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
          </div>
        )}

        {/* Filename / status */}
        <div className="flex-1 min-w-0">
          {file ? (
            <>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate">{file.name}</p>
              <p className="text-[10px] text-zinc-400">{(file.size / 1024).toFixed(0)} KB • new file</p>
            </>
          ) : currentName ? (
            <>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate">{currentName}</p>
              <p className="text-[10px] text-zinc-400 group-hover:text-indigo-500 transition-colors">Click to replace</p>
            </>
          ) : (
            <p className="text-xs text-zinc-400 group-hover:text-indigo-500 transition-colors">Click to upload</p>
          )}
        </div>

        {/* Chevron */}
        <svg className="h-4 w-4 text-zinc-300 dark:text-zinc-600 shrink-0 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z" />
        </svg>
      </label>
    </div>
  );
}

export default function EditApplicantPanel({
  applicantId,
  initialDescription,
  initialExtractedData,
  initialImage,
  initialIdCard,
  initialPdf,
  onClose,
}: {
  applicantId: string;
  initialDescription: string;
  initialExtractedData?: ExtractedData;
  initialImage?: UploadedFile;
  initialIdCard?: UploadedFile;
  initialPdf?: UploadedFile;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const [description, setDescription] = useState(initialDescription);
  const [extractedData, setExtractedData] = useState<ExtractedData>(
    initialExtractedData ?? null
  );

  // File replacement state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      if (idCardPreview) URL.revokeObjectURL(idCardPreview);
    };
  }, [imagePreview, idCardPreview]);

  const setField = (key: keyof NonNullable<ExtractedData>, value: string) => {
    setExtractedData((prev) => ({ ...(prev ?? {}), [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const hasFiles = imageFile || idCardFile || pdfFile;

      let res: Response;

      if (hasFiles) {
        // Use FormData so files can be uploaded
        const formData = new FormData();
        formData.set("description", description);
        if (extractedData !== null && extractedData !== undefined) {
          formData.set("extractedData", JSON.stringify(extractedData));
        }
        if (imageFile) formData.set("image", imageFile);
        if (idCardFile) formData.set("idCard", idCardFile);
        if (pdfFile) formData.set("pdf", pdfFile);

        res = await fetch(`/api/applicants/${applicantId}`, {
          method: "PATCH",
          body: formData,
          // No Content-Type header — browser sets it with the correct boundary
        });
      } else {
        // JSON-only update (no files changed)
        const body: Record<string, unknown> = { description };
        if (extractedData !== undefined) body.extractedData = extractedData;

        res = await fetch(`/api/applicants/${applicantId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? t("editFailed"));
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError(t("editFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-indigo-100 dark:border-indigo-900/40 px-4 py-4 bg-indigo-50/30 dark:bg-indigo-950/10 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            {t("editSubmission")}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          title={t("cancel")}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Description */}
      <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/60 p-4 space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
          {t("lblDescription")}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
          placeholder={t("descPlaceholder")}
        />
      </div>

      {/* File replacement section */}
      <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/60 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {t("lblApplicantImage")} / {t("lblIdCardImage")} / {t("lblPdfDocument")}
        </p>

        <div className="grid gap-3 sm:grid-cols-1">
          <FileSlot
            label={t("lblApplicantImage")}
            accept="image/*"
            isImage
            currentSrc={initialImage?.path ? `/api/applicants/${applicantId}/files?kind=image` : undefined}
            currentName={initialImage?.originalName}
            file={imageFile}
            preview={imagePreview}
            onFileChange={async (f, _) => {
              if (!f) { setImageFile(null); setImagePreview(null); return; }
              const compressed = await compressImage(f);
              const url = URL.createObjectURL(compressed);
              setImageFile(compressed);
              setImagePreview(url);
            }}
          />
          <FileSlot
            label={t("lblIdCardImage")}
            accept="image/*"
            isImage
            currentSrc={initialIdCard?.path ? `/api/applicants/${applicantId}/files?kind=idCard` : undefined}
            currentName={initialIdCard?.originalName}
            file={idCardFile}
            preview={idCardPreview}
            onFileChange={async (f, _) => {
              if (!f) { setIdCardFile(null); setIdCardPreview(null); return; }
              const compressed = await compressImage(f);
              const url = URL.createObjectURL(compressed);
              setIdCardFile(compressed);
              setIdCardPreview(url);
            }}
          />
          <FileSlot
            label={t("lblPdfDocument")}
            accept="image/*,application/pdf"
            isImage={false}
            currentName={initialPdf?.originalName}
            file={pdfFile}
            preview={null}
            onFileChange={(f) => setPdfFile(f)}
          />
        </div>
      </div>

      {/* Extracted data fields */}
      {extractedData !== null && (
        <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/60 p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {t("idPreviewTitle")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.key} className={`space-y-0.5 ${"full" in field && field.full ? "sm:col-span-2" : ""}`}>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                  {t(field.labelKey)}
                </label>
                <input
                  type="text"
                  value={(extractedData?.[field.key] as string) ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                  placeholder="-"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors disabled:opacity-50"
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-60 shadow-sm shadow-indigo-500/20"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t("saving")}
            </>
          ) : (
            t("saveChanges")
          )}
        </button>
      </div>
    </div>
  );
}
