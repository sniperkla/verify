import Link from "next/link";
import { getTranslationsServer } from "@/lib/i18n-server";

export default async function Home() {
  const t = await getTranslationsServer();

  return (
    <div className="relative isolate overflow-hidden">
      {/* Hero Section */}
      <div className="mx-auto max-w-5xl px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="text-center">
          {/* Subtle Announcement Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-medium text-indigo-600 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-400">
            <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
            {t("collaborationLive")}
          </div>
          
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-700 bg-clip-text text-transparent dark:from-white dark:via-zinc-200 dark:to-zinc-400">
            {t("heroTitle1")} <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
              {t("heroTitle2")}
            </span>
          </h1>
          
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400 sm:text-lg">
            {t("heroSubtitle")}
          </p>
          
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 focus-visible:outline-2 transition-all duration-200 sm:w-auto"
            >
              {t("getStartedFree")}
            </Link>
            <Link
              href="/login"
              className="w-full rounded-xl border border-zinc-200 bg-white/50 backdrop-blur px-6 py-3 text-center text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100 dark:hover:bg-zinc-800/80 sm:w-auto"
            >
              {t("signInDashboard")}
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 sm:mt-28">
          <h2 className="text-center text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            {t("builtForTeams")}
          </h2>
          <p className="mt-2 text-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            {t("gridTitle")}
          </p>
          
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="glass-panel hover-glow rounded-2xl p-6 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-white">{t("feature1Title")}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {t("feature1Desc")}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-panel hover-glow rounded-2xl p-6 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-white">{t("feature2Title")}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {t("feature2Desc")}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-panel hover-glow rounded-2xl p-6 transition-all sm:col-span-2 lg:col-span-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-white">{t("feature3Title")}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {t("feature3Desc")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

