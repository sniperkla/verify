"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n-client";

type Space = { id: string; name: string; role: "admin" | "member" };

export default function WorkspaceBar({ currentSpace }: { currentSpace: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/spaces");
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t("errLoadSpaces"));
      return;
    }
    const data = (await res.json()) as { spaces: Space[] };
    setSpaces(data.spaces ?? []);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const currentSpaceObj = useMemo(
    () => spaces.find((s) => s.id === currentSpace) ?? null,
    [spaces, currentSpace]
  );

  const onSelect = (value: string) => {
    setInviteCode(null);
    if (value === "personal") router.push("/dashboard");
    else router.push(`/dashboard?space=${encodeURIComponent(value)}`);
  };

  const createSpace = async () => {
    setError(null);
    setInviteCode(null);
    const name = createName.trim();
    if (!name) return;
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t("errCreateSpace"));
      return;
    }
    const data = (await res.json()) as { id: string };
    setCreateName("");
    await load();
    router.push(`/dashboard?space=${encodeURIComponent(data.id)}`);
  };

  const joinSpace = async () => {
    setError(null);
    setInviteCode(null);
    const code = joinCode.trim();
    if (!code) return;
    const res = await fetch("/api/spaces/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t("errJoinSpace"));
      return;
    }
    const data = (await res.json()) as { spaceId: string };
    setJoinCode("");
    await load();
    router.push(`/dashboard?space=${encodeURIComponent(data.spaceId)}`);
  };

  const generateInvite = async () => {
    if (!currentSpaceObj) return;
    setError(null);
    setInviteCode(null);
    setInviteLoading(true);
    const res = await fetch(`/api/spaces/${currentSpaceObj.id}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "member", expiresInDays: 14 }),
    });
    setInviteLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t("errGenerateInvite"));
      return;
    }
    const data = (await res.json()) as { token: string };
    setInviteCode(data.token);
  };

  const handleCopy = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-900/40 overflow-hidden">
      {/* Top bar: workspace select + role badge + invite button */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="relative flex-1">
          <select
            className="w-full appearance-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-3 pr-8 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            value={currentSpace}
            onChange={(e) => onSelect(e.target.value)}
            disabled={loading}
          >
            <option value="personal">{t("personalWorkspace")}</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <span className="shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          {currentSpaceObj ? currentSpaceObj.role : t("roleAdmin")}
        </span>

        {currentSpaceObj?.role === "admin" ? (
          <button
            onClick={generateInvite}
            disabled={inviteLoading}
            title={t("generateInviteCode")}
            className="shrink-0 flex items-center justify-center rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/30 p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {inviteLoading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
          </button>
        ) : null}
      </div>

      {/* Invite code result */}
      {inviteCode ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/60 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/40">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 dark:text-indigo-500">{t("generatedInviteCode")}</p>
            <p className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{inviteCode}</p>
          </div>
          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            {copied ? (
              <><svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-emerald-600 dark:text-emerald-400">{t("copied")}</span></>
            ) : (
              <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span>{t("btnCopyCode")}</span></>
            )}
          </button>
        </div>
      ) : null}

      {/* Create + Join */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100 dark:divide-zinc-800/60">
        <div className="flex items-center gap-1.5 px-3 py-2">
          <input
            className="flex-1 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 px-3 py-1.5 text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder={t("createSpacePlaceholder")}
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createSpace()}
          />
          <button
            onClick={createSpace}
            className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            {t("btnCreate")}
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-2">
          <input
            className="flex-1 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 px-3 py-1.5 text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            placeholder={t("joinSpacePlaceholder")}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinSpace()}
          />
          <button
            onClick={joinSpace}
            className="shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {t("btnJoin")}
          </button>
        </div>
      </div>

      {error ? (
        <p className="px-3 pb-2 text-[11px] font-medium text-red-500 dark:text-red-400">{error}</p>
      ) : null}
    </section>
  );
}

