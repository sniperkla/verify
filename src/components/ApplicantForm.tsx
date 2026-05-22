"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n-client";
import { type ExtractedIdData, type FaceBox, normalizeFaceBox } from "@/lib/id-extraction";

/**
 * Compress an image File using the Canvas API.
 * - Only processes image/* files (PDFs pass through unchanged).
 * - Resizes so the longest side ≤ maxPx (default 1920).
 * - Re-encodes as JPEG at the given quality (default 0.85).
 * - If the image is already small enough, the original File is returned as-is.
 */
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

      // Already fits — skip re-encoding
      if (w <= maxPx && h <= maxPx) {
        resolve(file);
        return;
      }

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
          const name = file.name.replace(/\.[^.]+$/, ".jpg");
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function ApplicantForm({
  onUploaded,
  spaceId,
}: {
  onUploaded?: () => void;
  spaceId: string; // "personal" or space id
}) {
  const router = useRouter();
  const { t } = useTranslation();
  
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [idCard, setIdCard] = useState<File | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null);

  const MAX_APPLICATION_FILES = 10;
  const [applicationImages, setApplicationImages] = useState<File[]>([]);
  const [applicationImagePreviews, setApplicationImagePreviews] = useState<string[]>([]);

  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // AI Summarizer States
  const [descriptionTags, setDescriptionTags] = useState<string[]>([]);
  const [summarizing, setSummarizing] = useState(false);

  // Debounce description → call summarize API
  useEffect(() => {
    if (description.trim().length < 10) {
      setDescriptionTags([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSummarizing(true);
      try {
        const res = await fetch("/api/applicants/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description }),
        });
        if (res.ok) {
          const data = await res.json();
          setDescriptionTags(data.tags ?? []);
        }
      } catch {
        // silently ignore
      } finally {
        setSummarizing(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [description]);

  // AI Extraction States
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedIdData | null>(null);
  const [croppedFace, setCroppedFace] = useState<string | null>(null);
  const [detectingApplicantFace, setDetectingApplicantFace] = useState(false);
  const [applicantFaceBox, setApplicantFaceBox] = useState<FaceBox | null>(null);
  const [applicantCroppedFace, setApplicantCroppedFace] = useState<string | null>(null);
  const [applicantFaceStatus, setApplicantFaceStatus] = useState<string | null>(null);

  // Clean up object URLs on change/unmount
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      if (idCardPreview) URL.revokeObjectURL(idCardPreview);
      for (const preview of applicationImagePreviews) URL.revokeObjectURL(preview);
    };
  }, [imagePreview, idCardPreview, applicationImagePreviews]);

  const resetApplicantFaceDetection = () => {
    setDetectingApplicantFace(false);
    setApplicantFaceBox(null);
    setApplicantCroppedFace(null);
    setApplicantFaceStatus(null);
  };

  const handleImageChange = async (file: File | null) => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    resetApplicantFaceDetection();

    if (file) {
      // Show preview immediately from the original for speed
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);

      // Compress before storing / uploading
      const compressed = await compressImage(file);
      setImage(compressed);

      setDetectingApplicantFace(true);
      try {
        const fd = new FormData();
        fd.append("image", compressed);
        const res = await fetch("/api/applicants/detect-face", {
          method: "POST",
          body: fd,
        });

        setDetectingApplicantFace(false);

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          setApplicantFaceStatus(errData?.error ?? t("photoDetectionFailed"));
          return;
        }

        const resData = (await res.json()) as { success?: boolean; data?: { faceBox?: unknown } };
        const normalizedFaceBox = normalizeFaceBox(resData.data?.faceBox);
        if (!normalizedFaceBox) {
          setApplicantFaceStatus(t("noHumanFaceDetected"));
          return;
        }

        setApplicantFaceBox(normalizedFaceBox);
        const cropped = await cropFace(previewUrl, normalizedFaceBox);
        setApplicantCroppedFace(cropped);
      } catch {
        setDetectingApplicantFace(false);
        setApplicantFaceStatus(t("photoDetectionFailed"));
      }
    } else {
      setImagePreview(null);
    }
  };

  const cropFace = (imageUrl: string, faceBox: unknown): Promise<string | null> => {
    const normalizedFaceBox = normalizeFaceBox(faceBox);
    if (!normalizedFaceBox) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageUrl;
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }

          const imgW = img.naturalWidth;
          const imgH = img.naturalHeight;
          const [top, left, bottom, right] = normalizedFaceBox;

          // Add 15% padding around the face for context
          const padX = (right - left) * 0.15;
          const padY = (bottom - top) * 0.15;

          // Clamp padded box to image bounds
          const xmin = Math.max(0, ((left - padX) / 100) * imgW);
          const ymin = Math.max(0, ((top - padY) / 100) * imgH);
          const xmax = Math.min(imgW, ((right + padX) / 100) * imgW);
          const ymax = Math.min(imgH, ((bottom + padY) / 100) * imgH);

          const cropW = xmax - xmin;
          const cropH = ymax - ymin;

          if (cropW <= 0 || cropH <= 0) {
            resolve(null);
            return;
          }

          // Scale to 512px on the longest side, preserving aspect ratio
          const MAX = 512;
          const scale = MAX / Math.max(cropW, cropH);
          const outW = Math.round(cropW * scale);
          const outH = Math.round(cropH * scale);

          canvas.width = outW;
          canvas.height = outH;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          ctx.drawImage(img, xmin, ymin, cropW, cropH, 0, 0, outW, outH);
          resolve(canvas.toDataURL("image/jpeg", 0.95));
        } catch (error) {
          console.error("Canvas face cropping failed:", error);
          resolve(null);
        }
      };
      img.onerror = () => {
        console.error("Canvas face cropping failed: image could not be loaded");
        resolve(null);
      };
    });
  };

  const extractFacePreviewStyle = (faceBox: unknown) => {
    const normalizedFaceBox = normalizeFaceBox(faceBox);
    if (!normalizedFaceBox) {
      return null;
    }

    const [top, left, bottom, right] = normalizedFaceBox;
    const cropWidth = Math.max(1, right - left);
    const cropHeight = Math.max(1, bottom - top);

    return {
      top: `-${(top / cropHeight) * 100}%`,
      left: `-${(left / cropWidth) * 100}%`,
      width: `${(100 / cropWidth) * 100}%`,
      height: `${(100 / cropHeight) * 100}%`,
      objectFit: "cover" as const,
    };
  };

  const handleIdCardChange = async (file: File | null) => {
    if (idCardPreview) URL.revokeObjectURL(idCardPreview);
    setExtractedData(null);
    setCroppedFace(null);

    if (file) {
      // Show preview immediately
      const previewUrl = URL.createObjectURL(file);
      setIdCardPreview(previewUrl);

      // Compress before AI extraction
      const compressed = await compressImage(file);
      setIdCard(compressed);

      setExtracting(true);
      setStatus(null);

      const extractFd = new FormData();
      extractFd.append("idCard", compressed);

      const detectFd = new FormData();
      detectFd.append("image", compressed);

      try {
        // Run text extraction and face detection in parallel
        const [extractRes, detectRes] = await Promise.all([
          fetch("/api/applicants/extract-id", { method: "POST", body: extractFd }),
          fetch("/api/applicants/detect-face", { method: "POST", body: detectFd }),
        ]);

        setExtracting(false);

        // Parse both responses
        const extractData = extractRes.ok ? await extractRes.json().catch(() => null) : null;
        const detectData = detectRes.ok ? await detectRes.json().catch(() => null) as { success?: boolean; data?: { faceBox?: unknown } } : null;

        // Set extracted text data
        if (extractData?.success && extractData.data) {
          setExtractedData(extractData.data as ExtractedIdData);
        } else if (!extractRes.ok) {
          setStatus(extractData?.error ?? t("uploadFailed"));
        }

        // Face crop: prefer dedicated detect-face result, fallback to extract-id faceBox
        const primaryFaceBox = normalizeFaceBox(detectData?.data?.faceBox);
        const fallbackFaceBox = normalizeFaceBox(extractData?.data?.faceBox);
        const bestFaceBox = primaryFaceBox ?? fallbackFaceBox;

        if (bestFaceBox) {
          const cropped = await cropFace(previewUrl, bestFaceBox);
          setCroppedFace(cropped);
        }
      } catch {
        setExtracting(false);
        setStatus("Network error during AI extraction.");
      }
    } else {
      setIdCardPreview(null);
    }
  };

  const handleApplicationImagesChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const rawFiles = Array.from(files).filter((f) => f.size > 0);
    if (rawFiles.length === 0) return;

    // Compress image files in parallel (PDFs pass through unchanged)
    const nextFiles = await Promise.all(rawFiles.map((f) => compressImage(f)));

    setApplicationImages((prev) => {
      const remaining = MAX_APPLICATION_FILES - prev.length;
      return [...prev, ...nextFiles.slice(0, remaining)];
    });
    setApplicationImagePreviews((prev) => {
      const remaining = MAX_APPLICATION_FILES - prev.length;
      return [
        ...prev,
        ...nextFiles.slice(0, remaining).map((file) =>
          file.type === "application/pdf" ? "" : URL.createObjectURL(file)
        ),
      ];
    });
  };

  const removeApplicationImage = (index: number) => {
    setApplicationImages((prev) => prev.filter((_, i) => i !== index));
    setApplicationImagePreviews((prev) => {
      const preview = prev[index];
      if (preview) URL.revokeObjectURL(preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    const fd = new FormData();
    fd.append("spaceId", spaceId);
    if (image) fd.append("image", image);
    if (idCard) fd.append("idCard", idCard);
    for (const applicationImage of applicationImages) {
      fd.append("applicationImages", applicationImage);
    }
    fd.append("description", description);

    const extractedPayload = {
      ...(extractedData ?? {}),
      ...(applicantFaceBox ? { applicantFaceBox } : {}),
      ...(applicantCroppedFace ? { applicantCroppedFace } : {}),
    };

    if (Object.keys(extractedPayload).length > 0) {
      fd.append(
        "extractedData",
        JSON.stringify({
          ...extractedPayload,
          croppedFace: croppedFace, // includes base64 face image
        })
      );
    }

    const res = await fetch("/api/applicants", { method: "POST", body: fd });
    setLoading(false);

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setStatus(data?.error ?? t("uploadFailed"));
      return;
    }

    setStatus(t("saveSuccess"));
    setImage(null);
    setImagePreview(null);
    setIdCard(null);
    setIdCardPreview(null);
    for (const preview of applicationImagePreviews) URL.revokeObjectURL(preview);
    setApplicationImages([]);
    setApplicationImagePreviews([]);
    setDescription("");
    setExtractedData(null);
    setCroppedFace(null);
    resetApplicantFaceDetection();
    onUploaded?.();
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="p-4 sm:p-6 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Applicant Image Dropzone */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">{t("lblApplicantImage")}</label>
          <input
            id="applicant-image"
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
          />
          {imagePreview ? (
            <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden group aspect-[4/3] bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
              <img src={imagePreview} alt="Preview" className="h-full w-full object-contain" />

              {/* Detected face inset thumbnail */}
              {applicantCroppedFace ? (
                <div className="absolute bottom-2 left-2 flex items-end gap-2 pointer-events-none">
                  <div className="relative h-20 w-20 rounded-xl border-2 border-white/80 dark:border-zinc-700/80 overflow-hidden shadow-xl bg-black/20">
                    <img src={applicantCroppedFace} alt="Detected face" className="h-full w-full object-cover" />
                  </div>
                  <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                    Face detected
                  </span>
                </div>
              ) : detectingApplicantFace ? (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                  <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                    Detecting face…
                  </span>
                </div>
              ) : applicantFaceStatus ? (
                <div className="absolute bottom-2 left-2">
                  <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-zinc-300 backdrop-blur-sm">
                    No face
                  </span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => handleImageChange(null)}
                className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label
              htmlFor="applicant-image"
              className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl py-6 px-4 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white/40 dark:bg-zinc-900/20 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition duration-200 cursor-pointer text-center group aspect-[4/3]"
            >
              <svg className="h-8 w-8 text-zinc-400 dark:text-zinc-600 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="mt-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t("uploadPhoto")}</span>
              <span className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">PNG, JPG, WEBP up to 10MB</span>
            </label>
          )}

        </div>

        {/* ID Card Dropzone */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">{t("lblIdCardImage")}</label>
          <input
            id="idcard-image"
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(e) => handleIdCardChange(e.target.files?.[0] ?? null)}
          />
          {idCardPreview ? (
            <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden group aspect-[4/3] bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
              <img src={idCardPreview} alt="Preview" className="h-full w-full object-contain" />

              {/* Face crop indicator overlay */}
              {croppedFace ? (
                <div className="absolute bottom-2 left-2 flex items-end gap-2 pointer-events-none">
                  <div className="relative h-20 w-20 rounded-xl border-2 border-white/80 dark:border-zinc-700/80 overflow-hidden shadow-xl bg-black/20">
                    <img src={croppedFace} alt="ID card face" className="h-full w-full object-cover" />
                  </div>
                  <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                    Face detected
                  </span>
                </div>
              ) : extracting ? (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                  <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                    Scanning…
                  </span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => handleIdCardChange(null)}
                className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label
              htmlFor="idcard-image"
              className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl py-6 px-4 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white/40 dark:bg-zinc-900/20 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition duration-200 cursor-pointer text-center group aspect-[4/3]"
            >
              <svg className="h-8 w-8 text-zinc-400 dark:text-zinc-600 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.333 0 4 .667 4 2v1H5v-1c0-1.333 2.667-2 4-2z" />
              </svg>
              <span className="mt-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t("uploadIdCard")}</span>
              <span className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">{t("scanIdCardDesc")}</span>
            </label>
          )}
        </div>
      </div>

      {/* AI Extraction Loading Shimmer */}
      {extracting && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/10 p-5 dark:border-indigo-950/30 dark:bg-indigo-950/10 animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-ping" />
            <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="flex gap-4 flex-col sm:flex-row">
            <div className="h-24 w-24 rounded-2xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
            <div className="flex-1 space-y-2.5">
              <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        </div>
      )}

      {/* AI Extracted Preview Card */}
      {extractedData && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/10 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{t("idPreviewTitle")}</h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0L19 7M9 13H6v3l3.586-3.586" />
              </svg>
              {t("extractedBadge")}
            </span>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* Cropped Face */}
            <div className="flex flex-col items-center gap-1 shrink-0 mx-auto sm:mx-0">
              <div className="relative h-24 w-24 rounded-xl border border-zinc-200/85 dark:border-zinc-800/85 overflow-hidden bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center shadow-sm">
                {croppedFace ? (
                  <img src={croppedFace} alt="Extracted Face" className="h-full w-full object-cover" />
                ) : extractedData.faceBox && idCardPreview ? (() => {
                  const previewStyle = extractFacePreviewStyle(extractedData.faceBox);
                  if (!previewStyle) return (
                    <svg className="h-7 w-7 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  );
                  return (
                    <div className="absolute inset-0 overflow-hidden">
                      <img src={idCardPreview} alt="Face" className="absolute max-w-none" style={previewStyle} />
                    </div>
                  );
                })() : (
                  <svg className="h-7 w-7 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
              <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">{t("extractedFace")}</span>
            </div>

            {/* Editable fields */}
            <div className="flex-1 grid gap-2 grid-cols-1 sm:grid-cols-2">
              {(
                [
                  { key: "fullNameEn", label: t("fullNameEn") },
                  { key: "fullNameTh", label: t("fullNameTh") },
                  { key: "dateOfBirth", label: t("dob") },
                  { key: "gender", label: t("gender") },
                  { key: "nationality", label: t("nationality") },
                  { key: "address", label: t("address"), full: true },
                ] as { key: keyof typeof extractedData; label: string; full?: boolean }[]
              ).map(({ key, label, full }) => (
                <div key={key} className={`space-y-0.5 ${full ? "sm:col-span-2" : ""}`}>
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={(extractedData[key] as string) ?? ""}
                    onChange={(e) =>
                      setExtractedData((prev) => prev ? { ...prev, [key]: e.target.value } : prev)
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                    placeholder="-"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Application Pages — images and/or PDF */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
            {t("lblApplicationPages")}
          </label>
          {applicationImages.length > 0 ? (
            <label
              htmlFor="application-images"
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer"
            >
              {t("addMorePages")}
            </label>
          ) : null}
        </div>
        <input
          id="application-images"
          className="hidden"
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={(e) => {
            handleApplicationImagesChange(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        {applicationImages.length > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {applicationImages.map((file, index) => {
                const isPdf = file.type === "application/pdf";
                const preview = applicationImagePreviews[index];
                return (
                <div
                  key={`${file.name}-${index}`}
                  className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 aspect-[3/4] flex items-center justify-center"
                >
                  {isPdf ? (
                    <div className="flex flex-col items-center justify-center gap-2 p-3 text-center w-full h-full">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 break-all line-clamp-2 px-1">{file.name}</p>
                      <p className="text-[9px] text-zinc-400">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                  ) : (
                    <img
                      src={preview}
                      alt={`${t("pageLabel")} ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute left-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    {t("pageLabel")} {index + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeApplicationImage(index)}
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                );
              })}
            </div>
            {applicationImages.length >= MAX_APPLICATION_FILES && (
              <p className="text-[11px] text-amber-500 dark:text-amber-400 font-medium">สูงสุด {MAX_APPLICATION_FILES} ไฟล์แล้ว</p>
            )}
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {applicationImages.length} {t("pageLabel").toLowerCase()}
              {applicationImages.length > 1 ? "s" : ""} · {t("applicationPagesHint")}
            </p>
          </div>
        ) : (
          <label
            htmlFor="application-images"
            className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl py-6 px-4 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white/40 dark:bg-zinc-900/20 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition duration-200 cursor-pointer text-center group"
          >
            <svg className="h-8 w-8 text-zinc-400 dark:text-zinc-600 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-3-3v6m6 4H6a2 2 0 01-2-2V7a2 2 0 012-2h3l1-1h4l1 1h3a2 2 0 012 2v10a2 2 0 01-2 2z" />
            </svg>
            <span className="mt-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t("uploadApplicationPages")}</span>
            <span className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">{t("applicationPagesHint")}</span>
          </label>
        )}
      </div>

      {/* Description / Notes */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">{t("lblDescription")}</label>
        <textarea
          className="min-h-24 w-full rounded-2xl border border-zinc-200/80 bg-white/50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("descPlaceholder")}
        />
        {/* AI Summary Tags */}
        {(summarizing || descriptionTags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-0.5">
              {summarizing ? t("summarizingDesc") : t("aiSummaryTags")}
            </span>
            {summarizing ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              </span>
            ) : (
              descriptionTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300"
                >
                  {tag}
                </span>
              ))
            )}
          </div>
        )}
      </div>

      {status ? (
        <div className={`rounded-xl border p-3 text-xs font-medium ${
          status.includes("successfully") || status.includes("สำเร็จ") 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
            : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
        }`}>
          {status}
        </div>
      ) : null}

      <button
        disabled={loading || extracting}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 dark:focus:ring-offset-zinc-950 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:scale-100 disabled:shadow-none"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {t("submittingData")}
          </>
        ) : (
          t("btnSubmitSubmissions")
        )}
      </button>
    </form>
  );
}
