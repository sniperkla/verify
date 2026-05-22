"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n-client";

type Space = { id: string; name: string; role: "admin" | "member" };
type Panel = null | "create" | "join" | "invite";

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function spaceColor(name: string) {
  const colors = [
    "bg-violet-500", "bg-indigo-500", "bg-sky-500", "bg-teal-500",
    "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-pink-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function WorkspaceBar({ currentSpace }: { currentSpace: string }) {
  const router = useRouter();
  const { t } = useTranslation();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [panel, setPanel] = useState<Panel>(null);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Invite panel state
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
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
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentSpaceObj = useMemo(
    () => spaces.find((s) => s.id === currentSpace) ?? null,
    [spaces, currentSpace]
  );

  const onSelect = (value: string) => {
    setInviteCode(null);
    setPanel(null);
    router.push(`/dashboard?space=${encodeURIComponent(value)}`);
  };

  const togglePanel = (p: Panel) => {
    setPanel((prev) => (prev === p ? null : p));
    setError(null);
    setInviteCode(null);
    if (p !== "invite") setInviteRole("member");
  };

  const createSpace = async () => {
    const name = createName.trim();
    if (!name) return;
    setError(null);
    setActionLoading(true);
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t("errCreateSpace"));
      return;
    }
    const data = (await res.json()) as { id: string };
    setCreateName("");
    setPanel(null);
    await load();
    router.push(`/dashboard?space=${encodeURIComponent(data.id)}`);
  };

  const joinSpace = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setError(null);
    setActionLoading(true);
    const res = await fetch("/api/spaces/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t("errJoinSpace"));
      return;
    }
    const data = (await res.json()) as { spaceId: string };
    setJoinCode("");
    setPanel(null);
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
      body: JSON.stringify({ role: inviteRole, expiresInDays: 14 }),
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

  const isAdmin = currentSpaceObj?.role === "admin";

  return (
    <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-900/40 overflow-hidden">

      {/* ── Header row ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5">

        {/* Current workspace avatar + role corner badge */}
        <div className="relative shrink-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold select-none
              ${currentSpaceObj ? spaceColor(currentSpaceObj.name) : "bg-zinc-300 dark:bg-zinc-700"}`}
          >
            {currentSpaceObj ? (
              initials(currentSpaceObj.name)
            ) : (
              <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
            )}
          </div>
          {/* Role badge — tiny corner overlay */}
          {currentSpaceObj && (
            <span
              className={`absolute -bottom-1 -right-1 rounded-full text-[7px] font-extrabold leading-none px-1 py-0.5 border border-white dark:border-zinc-900 uppercase tracking-wide
                ${currentSpaceObj.role === "admin"
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-400 dark:bg-zinc-600 text-white"
                }`}
            >
              {currentSpaceObj.role === "admin" ? "A" : "M"}
            </span>
          )}
        </div>

        {/* Workspace selector */}
        <div className="relative flex-1 min-w-0">
          {spaces.length > 0 ? (
            <>
              <select
                className="w-full appearance-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent pl-2 pr-7 py-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
                value={currentSpace}
                onChange={(e) => onSelect(e.target.value)}
                disabled={loading}
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-zinc-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </>
          ) : (
            <p className="pl-1 text-xs text-zinc-400 dark:text-zinc-500 italic">
              {loading ? "Loading…" : "No workspaces yet — create one →"}
            </p>
          )}
        </div>

        {/* Role pill — only when in a named space, hidden on very small screens to save space */}
        {currentSpaceObj && (
          <span className="hidden sm:inline-flex shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            {currentSpaceObj.role}
          </span>
        )}

        {/* Action icon buttons — larger touch targets on mobile */}
        <div className="shrink-0 flex items-center gap-1">
          {/* Invite — only for space admin */}
          {isAdmin && (
            <button
              onClick={() => togglePanel("invite")}
              title={t("generateInviteCode")}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer
                ${panel === "invite"
                  ? "border-indigo-300 dark:border-indigo-700 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300"
                  : "border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>
          )}

          {/* New space */}
          <button
            onClick={() => togglePanel("create")}
            title={t("createNewSpace")}
            className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer
              ${panel === "create"
                ? "border-indigo-300 dark:border-indigo-700 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300"
                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* Join space */}
          <button
            onClick={() => togglePanel("join")}
            title={t("joinSpace")}
            className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer
              ${panel === "join"
                ? "border-zinc-400 dark:border-zinc-500 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Invite panel ──────────────────────────────────────────── */}
      {panel === "invite" && isAdmin && (
        <div className="mx-3 mb-2 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-950/20 overflow-hidden">
          {/* Role picker + generate button row */}
          <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 border-b border-indigo-100 dark:border-indigo-900/30">
            <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide shrink-0">
              {t("role")}
            </span>
            <div className="flex gap-1">
              {(["member", "admin"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => { setInviteRole(r); setInviteCode(null); }}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer
                    ${
                      inviteRole === r
                        ? "bg-indigo-600 text-white"
                        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50"
                    }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {/* Generate button */}
            <button
              onClick={generateInvite}
              disabled={inviteLoading}
              className="flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer sm:ml-auto"
            >
              {inviteLoading ? (
                <svg className="animate-spin h-2.5 w-2.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                </svg>
              )}
              {t("generateInviteCode")}
            </button>
          </div>

          {/* Generated code display */}
          {inviteCode && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 px-3 py-2.5">
              <span className="shrink-0 rounded bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-500">
                {inviteRole}
              </span>
              {/* Code — full width on its own line on mobile */}
              <div className="flex flex-1 items-center gap-2 min-w-0 w-full">
                <p className="flex-1 min-w-0 font-mono text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 truncate break-all">
                  {inviteCode}
                </p>
                <button
                  onClick={handleCopy}
                  className="shrink-0 flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-emerald-600 dark:text-emerald-400">{t("copied")}</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>{t("btnCopyCode")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Create panel ──────────────────────────────────────────── */}
      {panel === "create" && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-2.5">
          <svg className="shrink-0 h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <input
            className="flex-1 min-w-0 bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none py-1"
            placeholder={t("createSpacePlaceholder")}
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createSpace()}
            autoFocus
          />
          <button
            onClick={createSpace}
            disabled={actionLoading || !createName.trim()}
            className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {actionLoading ? "…" : t("btnCreate")}
          </button>
        </div>
      )}

      {/* ── Join panel ────────────────────────────────────────────── */}
      {panel === "join" && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/40 bg-zinc-50/50 dark:bg-zinc-800/20 px-3 py-2.5">
          <svg className="shrink-0 h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <input
            className="flex-1 min-w-0 bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none font-mono py-1"
            placeholder={t("joinSpacePlaceholder")}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinSpace()}
            autoFocus
          />
          <button
            onClick={joinSpace}
            disabled={actionLoading || !joinCode.trim()}
            className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {actionLoading ? "…" : t("btnJoin")}
          </button>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && (
        <p className="px-3 pb-2.5 text-[11px] font-medium text-red-500 dark:text-red-400 flex items-center gap-1">
          <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
