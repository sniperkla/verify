"use client";

import { useRouter } from "next/navigation";
import { useTransition, useRef, useEffect, ReactNode } from "react";

type SubmissionsContainerProps = {
  currentSpace: string;
  statusParam: string;
  totalCount: number;
  pendingCount: number;
  reviewingCount: number;
  doneCount: number;
  t: {
    filterAll: string;
    statusPending: string;
    statusReviewing: string;
    statusDone: string;
  };
  children: ReactNode;
};

export default function SubmissionsContainer({
  currentSpace,
  statusParam,
  totalCount,
  pendingCount,
  reviewingCount,
  doneCount,
  t,
  children,
}: SubmissionsContainerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const scrollPosRef = useRef<number | null>(null);

  const handleTabClick = (status?: string) => {
    // Capture and save the exact scroll position before changing parameters
    scrollPosRef.current = window.scrollY;

    startTransition(() => {
      const params = new URLSearchParams(window.location.search);
      if (status) {
        params.set("status", status);
      } else {
        params.delete("status");
      }
      // Use replace with scroll: false to avoid unnecessary scroll resetting or history bloat
      router.replace(`/dashboard?${params.toString()}`, { scroll: false });
    });
  };

  useEffect(() => {
    // When transition finishes and we have a stored scroll position, restore it
    if (!isPending && scrollPosRef.current !== null) {
      const savedScroll = scrollPosRef.current;
      
      // Use requestAnimationFrame to ensure the new DOM layout has fully rendered
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedScroll });
      });
      scrollPosRef.current = null;
    }
  }, [isPending]);

  return (
    <section className="space-y-3 sm:space-y-4">
      {/* Status tab bar */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800/80 pb-px gap-1 sm:gap-4 overflow-x-auto scrollbar-none">
        {(
          [
            { label: t.filterAll, count: totalCount, status: undefined, activeClass: "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400", badgeActive: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400" },
            { label: t.statusPending, count: pendingCount, status: "pending", activeClass: "border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-400", badgeActive: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" },
            { label: t.statusReviewing, count: reviewingCount, status: "reviewing", activeClass: "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400", badgeActive: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400" },
            { label: t.statusDone, count: doneCount, status: "done", activeClass: "border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400", badgeActive: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" },
          ] as const
        ).map(({ label, count, status, activeClass, badgeActive }) => {
          const isActive = status === undefined ? !statusParam : statusParam === status;
          return (
            <button
              key={label}
              type="button"
              onClick={() => handleTabClick(status)}
              className={`flex items-center gap-1.5 px-2 sm:px-0 pb-3 pt-1 text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
                isActive
                  ? activeClass
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-colors ${
                isActive
                  ? badgeActive
                  : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Children list wrapper with min-height and opacity transition during loading */}
      <div className={`relative transition-all duration-200 min-h-[300px] ${
        isPending ? "opacity-50 pointer-events-none filter blur-[0.5px]" : "opacity-100"
      }`}>
        {children}
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/10 dark:bg-zinc-950/10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent dark:border-indigo-400"></div>
          </div>
        )}
      </div>
    </section>
  );
}
