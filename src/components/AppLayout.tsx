import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Modal } from "./Modal";
import { usePortal } from "../context/PortalContext";
import { deletePortalGroup, leavePortalGroup } from "../lib/api";

const groupNavLinks = [
  { to: "/matches", label: "Wedstrijden" },
  { to: "/standings", label: "Standen" },
  { to: "/tiers", label: "Rangen" },
  { to: "/members", label: "Groepsbeheer" },
  { to: "/doubles", label: "2v2" },
];

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return "P";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppLayout() {
  const {
    user,
    activeGroup,
    groups,
    memberships,
    selectGroup,
    selectOverall,
    refreshSession,
    createGroup,
    joinGroup,
    updateDisplayName,
    logout,
  } = usePortal();

  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState("");
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [joinCreateOpen, setJoinCreateOpen] = useState(false);
  const [joinCreateTab, setJoinCreateTab] = useState<"join" | "create">("join");
  const [profileOpen, setProfileOpen] = useState(false);
  const [dangerAction, setDangerAction] = useState<"leave" | "delete" | null>(null);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [joinCodeDraft, setJoinCodeDraft] = useState("");
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [createCodeDraft, setCreateCodeDraft] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState(user?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const groupQueryInputRef = useRef<HTMLInputElement | null>(null);

  const joinedGroupIds = useMemo(
    () => new Set(memberships.map((membership) => membership.groupId)),
    [memberships],
  );
  const joinedGroups = useMemo(
    () => groups.filter((group) => joinedGroupIds.has(group.id)),
    [groups, joinedGroupIds],
  );
  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.groupId === activeGroup?.id) ?? null,
    [activeGroup?.id, memberships],
  );
  const activeIsOwner = activeMembership?.role === "owner";

  const selectedGroupLabel = activeGroup?.name ?? "Overal statistieken";

  const filteredGroups = useMemo(() => {
    const query = groupQuery.trim().toLocaleLowerCase("nl-NL");
    const items = [
      { id: "__overall__", label: "Overal statistieken", kind: "overall" as const },
      ...joinedGroups.map((group) => ({
        id: group.id,
        label: group.name,
        kind: "group" as const,
      })),
    ];

    if (!query) {
      return items;
    }

    return items.filter((item) => item.label.toLocaleLowerCase("nl-NL").includes(query));
  }, [groupQuery, joinedGroups]);

  useEffect(() => {
    setDisplayNameDraft(user?.displayName ?? "");
  }, [user?.displayName]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (groupMenuOpen && groupMenuRef.current && !groupMenuRef.current.contains(target)) {
        setGroupMenuOpen(false);
      }
      if (
        actionMenuOpen &&
        actionMenuRef.current &&
        !actionMenuRef.current.contains(target)
      ) {
        setActionMenuOpen(false);
      }
      if (
        accountMenuOpen &&
        accountMenuRef.current &&
        !accountMenuRef.current.contains(target)
      ) {
        setAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGroupMenuOpen(false);
        setActionMenuOpen(false);
        setAccountMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen, actionMenuOpen, groupMenuOpen]);

  useEffect(() => {
    if (groupMenuOpen) {
      window.setTimeout(() => {
        groupQueryInputRef.current?.focus();
      }, 0);
    } else {
      setGroupQuery("");
    }
  }, [groupMenuOpen]);

  const handleJoin = async () => {
    if (!selectedGroupId || !joinCodeDraft.trim()) {
      return;
    }

    setBusy(true);
    try {
      const result = await joinGroup({
        groupId: selectedGroupId,
        joinCode: joinCodeDraft.trim(),
      });
      setJoinCodeDraft("");
      setJoinCreateOpen(false);
      await selectGroup(result.group.id);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!groupNameDraft.trim() || !createCodeDraft.trim()) {
      return;
    }

    setBusy(true);
    try {
      const result = await createGroup({
        name: groupNameDraft.trim(),
        joinCode: createCodeDraft.trim(),
      });
      setGroupNameDraft("");
      setCreateCodeDraft("");
      setJoinCreateOpen(false);
      await selectGroup(result.group.id);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileBusy(true);
    try {
      await updateDisplayName(displayNameDraft.trim());
      setProfileOpen(false);
    } finally {
      setProfileBusy(false);
    }
  };

  const handleDangerAction = async () => {
    if (!activeGroup) {
      return;
    }

    setDangerBusy(true);
    try {
      if (dangerAction === "leave") {
        await leavePortalGroup(activeGroup.id);
      } else if (dangerAction === "delete") {
        await deletePortalGroup(activeGroup.id);
      }
      setDangerAction(null);
      setActionMenuOpen(false);
      await selectOverall();
      await refreshSession();
    } finally {
      setDangerBusy(false);
    }
  };

  const closeAllMenus = () => {
    setGroupMenuOpen(false);
    setActionMenuOpen(false);
    setAccountMenuOpen(false);
    setMobileNavOpen(false);
  };

  const renderSidebarContent = (isMobile = false) => (
    <>
      <div className="relative border-b border-white/5 px-4 py-4 sm:px-5">
        <p className="text-xs uppercase tracking-[0.35em] text-axoft-200">
          PingPong Scores
        </p>
        <div className="mt-4">
          <p className="mb-2 text-[10px] uppercase tracking-[0.4em] text-slate-500">
            Mijn groep
          </p>
          <div className="text-sm text-slate-400">
            Selecteer een groep of open het overzicht over al je accounts.
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1" ref={groupMenuRef}>
            <button
              type="button"
              onClick={() => setGroupMenuOpen((prev) => !prev)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
              aria-haspopup="listbox"
              aria-expanded={groupMenuOpen}
            >
              <span className="min-w-0 truncate text-sm font-medium text-white">
                {selectedGroupLabel}
              </span>
              <span className="text-xs text-slate-400">▾</span>
            </button>

            {groupMenuOpen ? (
              <div
                className={`absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-2xl backdrop-blur ${
                  isMobile ? "max-h-[60dvh]" : ""
                }`}
              >
                <input
                  ref={groupQueryInputRef}
                  value={groupQuery}
                  onChange={(event) => setGroupQuery(event.target.value)}
                  placeholder="Zoek groep of overal"
                  className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-axoft-400"
                />
                <div className="max-h-64 overflow-y-auto pr-1">
                  {filteredGroups.length ? (
                    filteredGroups.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={async () => {
                          setGroupMenuOpen(false);
                          if (item.kind === "overall") {
                            await selectOverall();
                            return;
                          }
                          await selectGroup(item.id);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          item.kind === "overall" &&
                          activeGroup == null &&
                          selectedGroupLabel === item.label
                            ? "bg-axoft-500 text-slate-950"
                            : item.kind === "group" && activeGroup?.id === item.id
                              ? "bg-axoft-500 text-slate-950"
                              : "text-slate-200 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        {item.kind === "overall" ? (
                          <span className="text-[11px] uppercase tracking-[0.2em] opacity-70">
                            Alles
                          </span>
                        ) : null}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-slate-400">
                      Geen groepen gevonden.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative shrink-0 pt-0.5" ref={actionMenuRef}>
            <button
              type="button"
              onClick={() => setActionMenuOpen((prev) => !prev)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg text-slate-300 transition hover:border-white/20 hover:text-white"
              aria-label="Groep acties"
            >
              ⋮
            </button>

            {actionMenuOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-2xl border border-white/15 bg-slate-950 p-1 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuOpen(false);
                    setJoinCreateTab("join");
                    setJoinCreateOpen(true);
                  }}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                >
                  Groep joinen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuOpen(false);
                    setJoinCreateTab("create");
                    setJoinCreateOpen(true);
                  }}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                >
                  Groep aanmaken
                </button>
                {activeGroup ? (
                  <>
                    <div className="my-1 h-px bg-white/10" />
                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false);
                        setDangerAction(activeIsOwner ? "delete" : "leave");
                      }}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-rose-200 transition hover:bg-rose-500/10 hover:text-rose-100"
                    >
                      {activeIsOwner ? "Groep verwijderen" : "Groep verlaten"}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-hidden px-2 py-4 sm:px-3">
        <div className="px-3 pb-2 pt-1 text-[10px] uppercase tracking-[0.4em] text-slate-500">
          Navigatie
        </div>
        <NavLink
          to="/"
          end
          onClick={() => {
            if (isMobile) closeAllMenus();
          }}
          className={({ isActive }) =>
            `flex items-center rounded-2xl px-3 py-3 text-sm font-medium transition ${
              isActive
                ? "bg-axoft-500 text-slate-950"
                : "text-slate-200 hover:bg-white/5 hover:text-white"
            }`
          }
        >
          Dashboard
        </NavLink>

        {groupNavLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={(event) => {
              if (!activeGroup) {
                event.preventDefault();
                return;
              }
              if (isMobile) closeAllMenus();
            }}
            className={({ isActive }) =>
              `flex items-center rounded-2xl px-3 py-3 text-sm transition ${
                activeGroup
                  ? isActive
                    ? "bg-axoft-500 text-slate-950"
                    : "text-slate-200 hover:bg-white/5 hover:text-white"
                  : "cursor-not-allowed text-slate-500 opacity-50"
              }`
            }
            title={
              activeGroup
                ? undefined
                : "Selecteer eerst een groep om deze pagina te openen"
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="relative border-t border-white/10 px-3 py-4 sm:px-4" ref={accountMenuRef}>
        <div className="mb-2 px-1 text-[10px] uppercase tracking-[0.4em] text-slate-500">
          Mijn account
        </div>
        <button
          type="button"
          onClick={() => setAccountMenuOpen((prev) => !prev)}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-axoft-500 text-sm font-semibold text-slate-950">
            {getInitials(user?.displayName ?? user?.email ?? "P")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user?.displayName ?? "Mijn account"}
            </p>
            <p className="truncate text-xs text-slate-400">
              {user?.email ?? "Ingelogd"}
            </p>
          </div>
          <span className="text-xs text-slate-400">▾</span>
        </button>

        {accountMenuOpen ? (
          <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/98 p-1 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                setProfileOpen(true);
              }}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
            >
              Profiel aanpassen
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                void logout();
              }}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-rose-200 transition hover:bg-rose-500/10 hover:text-rose-100"
            >
              Uitloggen
            </button>
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:h-screen lg:overflow-hidden">
      <div className="mx-auto max-w-[1600px] lg:grid lg:h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="sticky top-0 z-20 flex w-full items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 py-3 text-left lg:hidden"
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.35em] text-axoft-200">
              PingPong Scores
            </p>
            <p className="truncate text-sm font-medium text-white">
              {selectedGroupLabel}
            </p>
          </div>
          <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-lg text-slate-200">
            ☰
          </span>
        </button>

        <aside className="hidden flex-col border-b border-white/10 bg-slate-950/95 lg:flex lg:h-full lg:overflow-hidden lg:border-b-0 lg:border-r">
          {renderSidebarContent(false)}
        </aside>

        <main className="min-w-0 p-4 sm:p-6 lg:h-full lg:overflow-y-auto lg:p-8">
          <Outlet />
        </main>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            aria-label="Navigatie sluiten"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[88vw] max-w-sm overflow-hidden border-r border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-axoft-200">
                    Navigatie
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedGroupLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg text-slate-200"
                  aria-label="Sluiten"
                >
                  ×
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {renderSidebarContent(true)}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <Modal
        open={joinCreateOpen}
        onClose={() => setJoinCreateOpen(false)}
        title={joinCreateTab === "join" ? "Groep joinen" : "Groep aanmaken"}
        description={
          joinCreateTab === "join"
            ? "Kies een groep waar je al een code voor hebt."
            : "Maak een nieuwe groep met een eigen code."
        }
        size="sm"
        footer={null}
      >
        <div className="inline-flex rounded-full border border-white/10 bg-slate-900/80 p-1">
          <button
            type="button"
            onClick={() => setJoinCreateTab("join")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              joinCreateTab === "join"
                ? "bg-axoft-500 text-slate-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Joinen
          </button>
          <button
            type="button"
            onClick={() => setJoinCreateTab("create")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              joinCreateTab === "create"
                ? "bg-axoft-500 text-slate-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Maken
          </button>
        </div>

        {joinCreateTab === "join" ? (
          <div className="space-y-3">
            <select
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-axoft-400"
            >
              <option value="">Kies een groep</option>
              {groups
                .filter((group) => !joinedGroupIds.has(group.id))
                .map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
            </select>
            <input
              type="text"
              value={joinCodeDraft}
              onChange={(event) => setJoinCodeDraft(event.target.value)}
              placeholder="Geheime code"
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
            />
            <button
              type="button"
              onClick={() => void handleJoin()}
              disabled={busy}
              className="w-full rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
            >
              {busy ? "Bezig..." : "Groep joinen"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={groupNameDraft}
              onChange={(event) => setGroupNameDraft(event.target.value)}
              placeholder="Groepsnaam"
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
            />
            <input
              type="text"
              value={createCodeDraft}
              onChange={(event) => setCreateCodeDraft(event.target.value)}
              placeholder="Geheime code"
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={busy}
              className="w-full rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
            >
              {busy ? "Bezig..." : "Groep aanmaken"}
            </button>
          </div>
        )}
      </Modal>

      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Profiel aanpassen"
        description="Werk je weergavenaam bij."
        size="sm"
        footer={null}
      >
        <input
          type="text"
          value={displayNameDraft}
          onChange={(event) => setDisplayNameDraft(event.target.value)}
          placeholder="Weergavenaam"
          className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setProfileOpen(false)}
            className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={profileBusy}
            className="flex-1 rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
          >
            {profileBusy ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </Modal>

      <Modal
        open={dangerAction != null}
        onClose={() => setDangerAction(null)}
        title={dangerAction === "delete" ? "Groep verwijderen" : "Groep verlaten"}
        description={
          dangerAction === "delete"
            ? `Weet je zeker dat je ${activeGroup?.name ?? "deze groep"} wilt verwijderen? Deze actie verwijdert de groep en alle bijbehorende wedstrijden, standen en leden.`
            : `Weet je zeker dat je ${activeGroup?.name ?? "deze groep"} wilt verlaten?`
        }
        size="sm"
        footer={null}
      >
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDangerAction(null)}
            className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={() => void handleDangerAction()}
            disabled={dangerBusy}
            className="flex-1 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
          >
            {dangerBusy ? "Bezig..." : dangerAction === "delete" ? "Verwijderen" : "Verlaten"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
