"use client";

import { useState } from "react";
import ApplicantForm from "./ApplicantForm";
import { useTranslation } from "@/lib/i18n-client";

export default function CollapsibleForm({ spaceId }: { spaceId: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
      {/* Toggle bar — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/70 dark:bg-zinc-900/50 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-white shrink-0">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {t("newSubmission")}
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible content */}
      {open && (
        <div className="border-t border-zinc-100 dark:border-zinc-800/60">
          <ApplicantForm
            spaceId={spaceId}
            onUploaded={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
