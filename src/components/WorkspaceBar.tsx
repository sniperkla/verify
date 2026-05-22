"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n-client";

type Space = { id: string; name: string; role: "admin" | "member" };
type Panel = null | "create" | "join" | "invite";

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function spaceGradient(name: string): string {
  const gradients = [
    "from-violet-500 to-purple-600",
    "from-indigo-500 to-blue-600",
    "from-sky-400 to-cyan-600",
    "from-teal-500 to-emerald-600",
    "from-emerald-400 to-green-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-red-600",
    "from-pink-500 to-fuchsia-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

function WorkspaceAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const gradient = spaceGradient(name);
  const sizeClass =
    size === "sm"
      ? "h-6 w-6 text-[9px] rounded-md"
      : size === "lg"
      ? "h-10 w-10 text-sm rounded-xl"
      : "h-8 w-8 text-[11px] rounded-lg";
  return (
    <div
      className={`${sizeClass} bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold shrink-0 shadow-sm select-none`}
    >
      {initials(name)}
    </div>
  );
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function WorkspaceBar({ currentSpace }: { currentSpace: string }) {
  const router = useRouter();
  const { t } = useTranslation();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dropdown
  const [dropOpen, setDropOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Sub-panels
  const [panel, setPanel] = useState<Panel>(null);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Invite
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────
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

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentSpaceObj = useMemo(
    () => spaces.find((s) => s.id === currentSpace) ?? null,
    [spaces, currentSpace]
  );

  // ── Dropdown positioning + outside-click ────────────────────────────────
  const openDropdown = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 280) });
    setDropOpen((v) => !v);
  };

  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || dropRef.current?.contains(target)) return;
      setDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [dropOpen]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const onSelect = (id: string) => {
    setDropOpen(false);
    setPanel(null);
    setInviteCode(null);
    router.push(`/dashboard?space=${encodeURIComponent(id)}`);
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
    <>
      {/* ── Main workspace bar ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-900/40 overflow-hidden">

        {/* Trigger row */}
        <div className="flex items-center gap-1.5 p-1.5">

          {/* ── Workspace dropdown trigger ─── */}
          <button
            ref={triggerRef}
            type="button"
            onClick={openDropdown}
            disabled={loading}
            className="flex-1 min-w-0 flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50 transition-colors text-left disabled:opacity-60 group"
          >
            {/* Avatar */}
            {loading ? (
              <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse shrink-0" />
            ) : currentSpaceObj ? (
              <WorkspaceAvatar name={currentSpaceObj.name} />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                </svg>
              </div>
            )}

            {/* Name + role */}
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="space-y-1.5">
                  <div className="h-3 w-28 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                  <div className="h-2.5 w-14 rounded bg-zinc-100 dark:bg-zinc-800/60 animate-pulse" />
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate leading-tight">
                    {currentSpaceObj?.name ?? "Select workspace"}
                  </p>
                  {currentSpaceObj && (
                    <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 capitalize leading-tight mt-0.5">
                      {currentSpaceObj.role}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Chevron */}
            <svg
              className={`h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0 transition-transform duration-200 ${dropOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Divider */}
          <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />

          {/* ── Action buttons ─── */}
          <div className="flex items-center gap-0.5 pr-0.5 shrink-0">
            {/* Invite — admin only */}
            {isAdmin && (
              <button
                onClick={() => togglePanel("invite")}
                title={t("generateInviteCode")}
                className={`h-9 flex items-center gap-1.5 px-2.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                  panel === "invite"
                    ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                    : "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                }`}
              >
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="hidden sm:inline whitespace-nowrap">{t("generateInviteCode")}</span>
              </button>
            )}

            {/* New space */}
            <button
              onClick={() => togglePanel("create")}
              title={t("createNewSpace")}
              className={`h-9 flex items-center gap-1.5 px-2.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                panel === "create"
                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">{t("btnCreate")}</span>
            </button>

            {/* Join space */}
            <button
              onClick={() => togglePanel("join")}
              title={t("joinSpace")}
              className={`h-9 flex items-center gap-1.5 px-2.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                panel === "join"
                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span className="hidden sm:inline">{t("btnJoin")}</span>
            </button>
          </div>
        </div>

        {/* ── Invite panel ────────────────────────────────────────────── */}
        {panel === "invite" && isAdmin && (
          <div className="border-t border-zinc-100 dark:border-zinc-800/60 px-4 py-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {t("teammateInvites")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {/* Role segmented control */}
              <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-0.5">
                {(["member", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => { setInviteRole(r); setInviteCode(null); }}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer capitalize ${
                      inviteRole === r
                        ? "bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
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
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60 transition-colors cursor-pointer shadow-sm shadow-indigo-500/20"
              >
                {inviteLoading ? <Spinner className="h-3 w-3" /> : (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  </svg>
                )}
                {t("generateInviteCode")}
              </button>
            </div>

            {/* Generated code */}
            {inviteCode && (
              <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5">
                <span className="shrink-0 rounded-md bg-indigo-100 dark:bg-indigo-950/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {inviteRole}
                </span>
                <p className="flex-1 min-w-0 font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                  {inviteCode}
                </p>
                <button
                  onClick={handleCopy}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
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
                      {t("btnCopyCode")}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Create panel ─────────────────────────────────────────────── */}
        {panel === "create" && (
          <div className="border-t border-zinc-100 dark:border-zinc-800/60 px-4 py-4 space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {t("createNewSpace")}
            </p>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                placeholder={t("createSpacePlaceholder")}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createSpace()}
                autoFocus
              />
              <button
                onClick={createSpace}
                disabled={actionLoading || !createName.trim()}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 transition-colors cursor-pointer shadow-sm shadow-indigo-500/20"
              >
                {actionLoading ? <Spinner className="h-4 w-4" /> : t("btnCreate")}
              </button>
            </div>
          </div>
        )}

        {/* ── Join panel ───────────────────────────────────────────────── */}
        {panel === "join" && (
          <div className="border-t border-zinc-100 dark:border-zinc-800/60 px-4 py-4 space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {t("joinSpace")}
            </p>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 font-mono placeholder:text-zinc-400 placeholder:font-sans dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                placeholder={t("joinSpacePlaceholder")}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinSpace()}
                autoFocus
              />
              <button
                onClick={joinSpace}
                disabled={actionLoading || !joinCode.trim()}
                className="shrink-0 flex items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {actionLoading ? <Spinner className="h-4 w-4" /> : t("btnJoin")}
              </button>
            </div>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────── */}
        {error && (
          <div className="border-t border-red-100 dark:border-red-900/20 px-4 py-2.5 flex items-center gap-2 bg-red-50/50 dark:bg-red-950/10">
            <svg className="h-3.5 w-3.5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-[11px] font-medium text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* ── Custom floating dropdown ──────────────────────────────────────── */}
      {dropOpen && dropPos && (
        <div
          ref={dropRef}
          style={{
            position: "fixed",
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
          }}
          className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden"
        >
          {/* Workspace list */}
          <div className="py-1.5 max-h-60 overflow-y-auto">
            {spaces.length === 0 ? (
              <p className="px-4 py-3 text-sm text-zinc-400 dark:text-zinc-500 text-center italic">
                No workspaces yet — create one →
              </p>
            ) : (
              spaces.map((s) => {
                const isActive = s.id === currentSpace;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-950/40"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <WorkspaceAvatar name={s.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isActive ? "text-indigo-700 dark:text-indigo-300" : "text-zinc-800 dark:text-zinc-200"}`}>
                        {s.name}
                      </p>
                      <p className="text-[10px] capitalize font-medium text-zinc-400 dark:text-zinc-500 leading-tight">
                        {s.role}
                      </p>
                    </div>
                    {isActive && (
                      <svg className="h-4 w-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer actions */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 py-1.5">
            <button
              type="button"
              onClick={() => { setDropOpen(false); togglePanel("create"); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              <div className="h-6 w-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t("createNewSpace")}</span>
            </button>
            <button
              type="button"
              onClick={() => { setDropOpen(false); togglePanel("join"); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              <div className="h-6 w-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t("joinSpace")}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
