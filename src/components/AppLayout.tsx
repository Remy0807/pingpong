import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { usePortal } from "../context/PortalContext";

const primaryNavLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/matches", label: "Wedstrijden" },
  { to: "/doubles", label: "2v2" },
  { to: "/players", label: "Spelers" },
];

const secondaryNavLinks = [
  { to: "/head-to-head", label: "Onderlinge resultaten" },
  { to: "/recommendations", label: "Aanbevolen duels" },
  { to: "/elo-simulator", label: "Elo simulator" },
  { to: "/wall-of-shame", label: "Wall of Shame" },
];

export function AppLayout() {
  const { accountOverview, players, matches, doublesMatches, error, loading } =
    useAppData();
  const {
    user,
    activeGroup,
    activeGroupId,
    groups,
    memberships,
    selectGroup,
    selectOverall,
    createGroup,
    joinGroup,
    logout,
  } = usePortal();
  const location = useLocation();
  const [panelMode, setPanelMode] = useState<"join" | "create">("join");
  const [groupIdDraft, setGroupIdDraft] = useState("");
  const [joinCodeDraft, setJoinCodeDraft] = useState("");
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [createCodeDraft, setCreateCodeDraft] = useState("");
  const [busyPanel, setBusyPanel] = useState(false);

  const joinedGroupIds = useMemo(
    () => new Set(memberships.map((membership) => membership.groupId)),
    [memberships]
  );
  const joinedGroups = useMemo(
    () => groups.filter((group) => joinedGroupIds.has(group.id)),
    [groups, joinedGroupIds]
  );
  const joinableGroups = useMemo(
    () => groups.filter((group) => !joinedGroupIds.has(group.id)),
    [groups, joinedGroupIds]
  );

  const totalMatches = matches.length + doublesMatches.length;
  const scopeLabel = activeGroup?.name ?? "Overal statistieken";

  const handleJoin = async () => {
    if (!groupIdDraft) {
      return;
    }
    setBusyPanel(true);
    try {
      const result = await joinGroup({ groupId: groupIdDraft, joinCode: joinCodeDraft });
      setJoinCodeDraft("");
      await selectGroup(result.group.id);
    } finally {
      setBusyPanel(false);
    }
  };

  const handleCreate = async () => {
    if (!groupNameDraft.trim() || !createCodeDraft.trim()) {
      return;
    }
    setBusyPanel(true);
    try {
      const result = await createGroup({
        name: groupNameDraft.trim(),
        joinCode: createCodeDraft.trim(),
      });
      setGroupNameDraft("");
      setCreateCodeDraft("");
      await selectGroup(result.group.id);
    } finally {
      setBusyPanel(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-slate-950/95 p-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-axoft-200">
                PingPong Scores
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white">
                {user?.displayName ?? user?.email ?? "Mijn dashboard"}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => logout().catch(console.error)}
              className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
            >
              Uitloggen
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                Matches
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {accountOverview?.totals.matches ?? totalMatches}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                Groepen
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {joinedGroups.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                Scope
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-white">
                {scopeLabel}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2 rounded-3xl border border-white/10 bg-slate-900/40 p-3">
            <button
              type="button"
              onClick={() => selectOverall().catch(console.error)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                activeGroupId == null
                  ? "border-axoft-400 bg-axoft-500/10 text-white"
                  : "border-white/10 text-slate-200 hover:border-white/20"
              }`}
            >
              <span>Overal statistieken</span>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Alles
              </span>
            </button>
            <div className="max-h-52 overflow-y-auto pr-1">
              {joinedGroups.length ? (
                <div className="space-y-2">
                  {joinedGroups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => selectGroup(group.id).catch(console.error)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        activeGroupId === group.id
                          ? "border-axoft-400 bg-axoft-500/10 text-white"
                          : "border-white/10 text-slate-200 hover:border-white/20"
                      }`}
                    >
                      <span className="truncate">{group.name}</span>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                        {group.memberCount}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-2 text-sm text-slate-400">
                  Nog geen groepen gekoppeld.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                Groepen beheren
              </p>
              <div className="inline-flex rounded-full border border-white/10 bg-slate-950/70 p-1">
                <button
                  type="button"
                  onClick={() => setPanelMode("join")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    panelMode === "join"
                      ? "bg-axoft-500 text-slate-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Joinen
                </button>
                <button
                  type="button"
                  onClick={() => setPanelMode("create")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    panelMode === "create"
                      ? "bg-axoft-500 text-slate-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Maken
                </button>
              </div>
            </div>

            {panelMode === "join" ? (
              <div className="mt-3 space-y-3">
                <select
                  value={groupIdDraft}
                  onChange={(e) => setGroupIdDraft(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-axoft-400"
                >
                  <option value="">Kies een groep</option>
                  {joinableGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={joinCodeDraft}
                  onChange={(e) => setJoinCodeDraft(e.target.value)}
                  placeholder="Geheime code"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
                />
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={busyPanel || !groupIdDraft}
                  className="w-full rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
                >
                  {busyPanel ? "Bezig..." : "Groep joinen"}
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <input
                  type="text"
                  value={groupNameDraft}
                  onChange={(e) => setGroupNameDraft(e.target.value)}
                  placeholder="Groepsnaam"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
                />
                <input
                  type="text"
                  value={createCodeDraft}
                  onChange={(e) => setCreateCodeDraft(e.target.value)}
                  placeholder="Geheime code"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={busyPanel}
                  className="w-full rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
                >
                  {busyPanel ? "Bezig..." : "Groep maken"}
                </button>
              </div>
            )}
          </div>

          <nav className="mt-5 rounded-3xl border border-white/10 bg-slate-900/40 p-3">
            <p className="px-3 pb-2 text-xs uppercase tracking-[0.35em] text-slate-400">
              Navigatie
            </p>
            <div className="grid gap-1">
              {primaryNavLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-2xl px-3 py-2.5 text-sm transition ${
                      !activeGroupId && link.to !== "/"
                        ? "pointer-events-none cursor-not-allowed opacity-40"
                        : ""
                    } ${
                      isActive
                        ? "bg-axoft-500 text-slate-950"
                        : "text-slate-200 hover:bg-white/5 hover:text-white"
                    }`
                  }
                  end={link.to === "/"}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
            <details className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-200">
                Meer tools
              </summary>
              <div className="mt-3 grid gap-1">
                {secondaryNavLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `rounded-xl px-3 py-2 text-sm transition ${
                        !activeGroupId
                          ? "pointer-events-none cursor-not-allowed opacity-40"
                          : ""
                      } ${
                        isActive
                          ? "bg-axoft-500/90 text-slate-950"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>
            </details>
          </nav>
        </aside>

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <header className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-5 shadow-card backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.5em] text-axoft-200">
                  {activeGroup ? activeGroup.name : "Account overzicht"}
                </p>
                <h2 className="text-3xl font-semibold text-white">
                  {activeGroup
                    ? "Groepsdashboard"
                    : "Persoonlijk pingpongdashboard"}
                </h2>
                <p className="max-w-2xl text-sm text-slate-300">
                  {activeGroup
                    ? "Bekijk standings, wedstrijden en leden van deze groep."
                    : "Bekijk je eigen stats, maandoverzichten en schakels tussen al je groepen."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {accountOverview?.totals.groupsPlayed ?? joinedGroups.length} groepen
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {accountOverview?.totals.matches ?? totalMatches} matches totaal
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {scopeLabel}
                </span>
              </div>
            </div>
          </header>

          {error ? (
            <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="mt-6">
            <Outlet />
          </div>

          {loading ? (
            <p className="mt-6 text-center text-xs uppercase tracking-[0.4em] text-slate-500">
              Gegevens worden geladen...
            </p>
          ) : null}
        </main>
      </div>
    </div>
  );
}
