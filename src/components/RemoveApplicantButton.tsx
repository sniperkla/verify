"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n-client";

export default function RemoveApplicantButton({ applicantId }: { applicantId: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    if (removing || !window.confirm(t("confirmRemoveSubmission"))) {
      return;
    }

    setRemoving(true);
    setError(null);

    const response = await fetch(`/api/applicants/${encodeURIComponent(applicantId)}`, {
      method: "DELETE",
    });

    setRemoving(false);

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t("removeFailed"));
      return;
    }

    router.refresh();
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleRemove}
        disabled={removing}
        title={removing ? t("removing") : t("btnRemove")}
        className="rounded-lg p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {removing ? (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        )}
      </button>
      {error ? (
        <span className="text-[10px] font-medium text-red-500 max-w-[60px] text-center leading-tight">{error}</span>
      ) : null}
    </div>
  );
}
