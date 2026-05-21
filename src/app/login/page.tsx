"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n-client";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [callbackUrl] = useState(() => {
    if (typeof window === "undefined") return "/dashboard";
    const url = new URL(window.location.href);
    return url.searchParams.get("callbackUrl") ?? "/dashboard";
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);
    if (!res?.ok) {
      setError(t("invalidLogin"));
      return;
    }
    router.push(res.url ?? callbackUrl);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <div className="glass-panel shadow-xl shadow-indigo-500/5 rounded-3xl p-6 sm:p-10 border border-zinc-200/50 dark:border-zinc-800/50">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-700 bg-clip-text text-transparent dark:from-white dark:to-zinc-300">
            {t("welcomeBack")}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t("signInPrompt")}
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t("username")}
            </label>
            <input
              className="w-full rounded-xl border border-zinc-200/80 bg-white/50 px-3.5 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900/50"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="e.g. johndoe"
              required
            />
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {t("password")}
              </label>
            </div>
            <input
              className="w-full rounded-xl border border-zinc-200/80 bg-white/50 px-3.5 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900/50"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          {error ? (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </div>
          ) : null}

          <button
            disabled={loading}
            className="w-full flex justify-center items-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-semibold text-white shadow-md hover:from-indigo-500 hover:to-purple-500 transition-all duration-200 disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t("signingIn")}
              </span>
            ) : (
              t("signIn")
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {t("noAccount")}{" "}
          <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            {t("signUpFree")}
          </Link>
        </p>
      </div>
    </div>
  );
}

