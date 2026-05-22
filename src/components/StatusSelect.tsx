"use client";

import { useEffect, useRef, useState } from "react";

type Status = "pending" | "reviewing" | "done";

type StatusOption = {
  value: Status;
  pill: string;
  dot: string;
};

const OPTIONS: StatusOption[] = [
  {
    value: "pending",
    pill: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50",
    dot: "bg-amber-400",
  },
  {
    value: "reviewing",
    pill: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/50",
    dot: "bg-blue-400",
  },
  {
    value: "done",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50",
    dot: "bg-emerald-400",
  },
];

type Props = {
  value: Status;
  labels: Record<Status, string>;
  disabled?: boolean;
  onChange: (next: Status) => void;
};

export default function StatusSelect({ value, labels, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  // Dropdown fixed position
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

  const handleToggle = () => {
    if (disabled) return;
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setOpen((v) => !v);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current?.contains(target) ||
        dropRef.current?.contains(target)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // Close on scroll (reposition would be complex, just close)
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [open]);

  return (
    <>
      {/* Trigger pill */}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-bold transition-all cursor-pointer focus:outline-none shrink-0 ${current.pill} ${disabled ? "opacity-50 cursor-not-allowed" : "active:scale-95"}`}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${current.dot}`} />
        <span className="whitespace-nowrap">{labels[value]}</span>
        <svg
          className={`h-2.5 w-2.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown — rendered via fixed positioning to escape overflow:hidden parents */}
      {open && dropPos && (
        <div
          ref={dropRef}
          style={{ position: "fixed", top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className="min-w-[130px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden"
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before click
                setOpen(false);
                if (opt.value !== value) onChange(opt.value);
              }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] font-semibold transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/80 ${
                opt.value === value ? "bg-zinc-50/80 dark:bg-zinc-800/60" : ""
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${opt.dot}`} />
              <span className={opt.value === value
                ? "font-bold text-zinc-900 dark:text-white"
                : "text-zinc-600 dark:text-zinc-400"}>
                {labels[opt.value]}
              </span>
              {opt.value === value && (
                <svg className="ml-auto h-3 w-3 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
