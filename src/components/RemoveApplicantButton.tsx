"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n-client";

export default function RemoveApplicantButton({ applicantId }: { applicantId: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"idle" | "confirm" | "removing">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    if (phase === "removing") return;

    if (phase === "idle") {
      // First click → show inline confirm
      setPhase("confirm");
      return;
    }

    // Second click (confirmed) → delete
    setPhase("removing");
    setError(null);

    const response = await fetch(`/api/applicants/${encodeURIComponent(applicantId)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t("removeFailed"));
      setPhase("idle");
      return;
    }

    router.refresh();
  };

  // Idle — just the trash icon
  if (phase === "idle") {
    return (
      <button
        type="button"
        onClick={handleRemove}
        title={t("btnRemove")}
        className="rounded-lg p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
        </svg>
      </button>
    );
  }

  // Removing — spinner
  if (phase === "removing") {
    return (
      <div className="flex items-center gap-1.5 rounded-lg px-2 py-1 bg-red-50 dark:bg-red-950/30">
        <svg className="h-3.5 w-3.5 animate-spin text-red-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">{t("removing")}</span>
      </div>
    );
  }

  // Confirm — compact icon-only pill (no text, so it never overflows on mobile)
  return (
    <div className="flex items-center gap-1">
      {error && (
        <span className="text-[9px] font-medium text-red-500">{error}</span>
      )}
      <div className="flex items-center gap-0.5 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 px-1 py-0.5">
        {/* Trash icon (static, just signals context) */}
        <svg className="h-3.5 w-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
        </svg>
        {/* Cancel */}
        <button
          type="button"
          onClick={() => { setPhase("idle"); setError(null); }}
          className="rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          title="Cancel"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {/* Confirm delete */}
        <button
          type="button"
          onClick={handleRemove}
          className="rounded p-0.5 text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          title={t("confirmRemoveSubmission")}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
