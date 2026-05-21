"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n-client";

export default function NavBar() {
  const { data } = useSession();
  const pathname = usePathname();
  const { locale, setLocale, t } = useTranslation();

  const userInitial = data?.user?.name ? data.user.name.charAt(0).toUpperCase() : "U";

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/50 bg-white/80 backdrop-blur-md dark:border-zinc-800/50 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 h-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 font-bold text-white text-sm shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            C
          </div>
          <span className="hidden sm:block font-bold tracking-tight text-base bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-transparent dark:from-white dark:to-zinc-300">
            Collector<span className="text-indigo-500 dark:text-indigo-400">.</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Lang switcher */}
          <div className="flex items-center rounded-lg bg-zinc-100 dark:bg-zinc-900 p-0.5 border border-zinc-200/50 dark:border-zinc-800/50">
            {(["th", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold transition-all cursor-pointer ${
                  locale === l
                    ? "bg-white text-indigo-600 shadow-sm dark:bg-zinc-800 dark:text-indigo-400"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {data?.user ? (
            <>
              {/* Dashboard link — icon on mobile, text on sm+ */}
              <Link
                href="/dashboard"
                className={`hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  pathname === "/dashboard"
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                {t("dashboard")}
              </Link>

              {/* User avatar */}
              <div
                title={`${t("signedInAs")} ${data.user.name}`}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500/15 to-purple-500/15 border border-indigo-500/25 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 select-none"
              >
                {userInitial}
              </div>

              {/* Sign out — icon on mobile */}
              <button
                title={t("logout")}
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 text-zinc-500 hover:text-red-500 hover:border-red-200 dark:hover:text-red-400 dark:hover:border-red-900/50 transition-colors cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
              >
                {t("login")}
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                {t("signUp")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

