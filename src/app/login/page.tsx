"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n-client";

/** Safely extract just the pathname+search from an absolute or relative URL */
function safeRedirectPath(url: string | null | undefined): string {
  if (!url) return "/dashboard";
  try {
    // If it's absolute (e.g. http://localhost:3000/dashboard?x=1), extract only the path
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    // Already a relative path like /dashboard
    return url.startsWith("/") ? url : "/dashboard";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { status } = useSession();

  // Redirect already-authenticated users away from login
  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  const [callbackUrl] = useState<string>(() => {
    if (typeof window === "undefined") return "/dashboard";
    const param = new URL(window.location.href).searchParams.get("callbackUrl");
    return safeRedirectPath(param);
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // ── Credentials sign-in ───────────────────────────────────────────────────
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

    // res.url may be an absolute URL — extract only the pathname to avoid router issues
    router.push(safeRedirectPath(res.url) || callbackUrl);
  };

  // ── Google sign-in ────────────────────────────────────────────────────────
  const onGoogleSignIn = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl });
    // signIn with Google redirects automatically; no need to setGoogleLoading(false)
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

        {/* ── Google button ────────────────────────────────────────────── */}
        <div className="mt-8">
          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-100 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-150 disabled:opacity-60 cursor-pointer"
          >
            {googleLoading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              /* Official Google "G" logo SVG */
              <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
            )}
            {t("signInWithGoogle")}
          </button>
        </div>

        {/* ── Divider ──────────────────────────────────────────────────── */}
        <div className="relative my-6 flex items-center">
          <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
          <span className="mx-3 text-xs text-zinc-400 dark:text-zinc-500">
            {t("orDivider")}
          </span>
          <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
        </div>

        {/* ── Credentials form ─────────────────────────────────────────── */}
        <form onSubmit={onSubmit} className="space-y-5">
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
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t("password")}
            </label>
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
            disabled={loading || googleLoading}
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
