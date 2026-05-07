import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Modal } from "./Modal";
import { useAppData } from "../context/AppDataContext";
import { usePortal } from "../context/PortalContext";

const groupNavLinks = [
  { to: "/matches", label: "Wedstrijden" },
  { to: "/doubles", label: "2v2" },
  { to: "/players", label: "Spelers" },
  { to: "/head-to-head", label: "Onderlinge resultaten" },
  { to: "/recommendations", label: "Aanbevolen duels" },
  { to: "/elo-simulator", label: "Elo simulator" },
  { to: "/wall-of-shame", label: "Wall of Shame" },
];

type AccountMenuKey = "profile" | "logout";

export function AppLayout() {
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
    updateDisplayName,
    logout,
  } = usePortal();
  const [groupPickerValue, setGroupPickerValue] = useState("Overal statistieken");
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalTab, setGroupModalTab] = useState<"join" | "create">("join");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [joinCodeDraft, setJoinCodeDraft] = useState("");
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [createCodeDraft, setCreateCodeDraft] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState(user?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState<null | AccountMenuKey>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    setGroupPickerValue(activeGroup?.name ?? "Overal statistieken");
  }, [activeGroup?.name]);

  useEffect(() => {
    setDisplayNameDraft(user?.displayName ?? "");
  }, [user?.displayName]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!accountMenuRef.current) {
        return;
      }
      if (
        accountMenuOpen &&
        event.target instanceof Node &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setAccountMenuOpen(false);
      }
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [accountMenuOpen]);

  const selectGroupByName = async (value: string) => {
    const normalized = value.trim().toLocaleLowerCase("nl-NL");
    if (!normalized) {
      return;
    }
    if (
      normalized === "overall" ||
      normalized === "overal" ||
      normalized === "overal statistieken"
    ) {
      await selectOverall();
      return;
    }

    const group = joinedGroups.find(
      (entry) => entry.name.toLocaleLowerCase("nl-NL") === normalized
    );
    if (group) {
      await selectGroup(group.id);
      return;
    }
  };

  const handleJoinGroup = async () => {
    if (!selectedGroupId) {
      return;
    }
    setBusy(true);
    try {
      const result = await joinGroup({
        groupId: selectedGroupId,
        joinCode: joinCodeDraft,
      });
      setJoinCodeDraft("");
      setGroupPickerValue(result.group.name);
      await selectGroup(result.group.id);
      setGroupModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateGroup = async () => {
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
      setGroupPickerValue(result.group.name);
      await selectGroup(result.group.id);
      setGroupModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    setAccountBusy("profile");
    try {
      await updateDisplayName(displayNameDraft);
      setProfileModalOpen(false);
    } finally {
      setAccountBusy(null);
    }
  };

  const openGroupModal = (tab: "join" | "create") => {
    setGroupModalTab(tab);
    setGroupModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col border-b border-white/10 bg-slate-950/95 p-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-axoft-200">
                PingPong Scores
              </p>
              <h1 className="mt-2 text-lg font-semibold text-white">
                {user?.displayName ?? "Mijn account"}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setAccountMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-xl text-slate-300 transition hover:border-white/20 hover:text-white"
              aria-label="Accountmenu"
            >
              ⋮
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.3em] text-slate-500">
                Groep
              </label>
              <div className="flex gap-2">
                <input
                  list="group-picker-options"
                  value={groupPickerValue}
                  onChange={(event) => setGroupPickerValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void selectGroupByName(groupPickerValue);
                    }
                  }}
                  className="flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
                  placeholder="Zoek groep of overall"
                />
                <button
                  type="button"
                  onClick={() => void selectGroupByName(groupPickerValue)}
                  className="rounded-2xl bg-axoft-500 px-3 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400"
                >
                  Ga
                </button>
              </div>
              <datalist id="group-picker-options">
                <option value="Overal statistieken" />
                {joinedGroups.map((group) => (
                  <option key={group.id} value={group.name} />
                ))}
              </datalist>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  Actief
                </p>
                <p className="text-sm font-medium text-white">
                  {activeGroup?.name ?? "Overal statistieken"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void selectOverall()}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                Alles
              </button>
            </div>
          </div>

          <nav className="mt-5 rounded-3xl border border-white/10 bg-slate-900/40 p-3">
            <p className="px-3 pb-2 text-xs uppercase tracking-[0.35em] text-slate-400">
              Navigatie
            </p>
            <div className="grid gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `rounded-2xl px-3 py-2.5 text-sm transition ${
                    isActive
                      ? "bg-axoft-500 text-slate-950"
                      : "text-slate-200 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                Dashboard
              </NavLink>
              {activeGroupId ? (
                <>
                  {groupNavLinks.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) =>
                        `rounded-2xl px-3 py-2.5 text-sm transition ${
                          isActive
                            ? "bg-axoft-500 text-slate-950"
                            : "text-slate-200 hover:bg-white/5 hover:text-white"
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  ))}
                </>
              ) : (
                <p className="px-3 py-2 text-sm text-slate-500">
                  Kies een groep om groep-specifieke pagina&apos;s te openen.
                </p>
              )}
            </div>
          </nav>

          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => openGroupModal("join")}
              className="flex-1 rounded-2xl border border-white/10 px-3 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
            >
              Groep joinen
            </button>
            <button
              type="button"
              onClick={() => openGroupModal("create")}
              className="flex-1 rounded-2xl border border-white/10 px-3 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
            >
              Groep maken
            </button>
          </div>

          <div className="mt-auto pt-5">
            {accountMenuOpen ? (
              <div
                ref={accountMenuRef}
                className="rounded-3xl border border-white/10 bg-slate-900/80 p-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setProfileModalOpen(true);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                >
                  <span>Profiel aanpassen</span>
                  <span className="text-xs text-slate-500">↗</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    void logout();
                  }}
                  className="mt-1 flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm text-rose-200 transition hover:bg-rose-500/10 hover:text-rose-100"
                >
                  <span>Uitloggen</span>
                  <span className="text-xs text-rose-300">⎋</span>
                </button>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <Modal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        title={groupModalTab === "join" ? "Groep joinen" : "Groep maken"}
        description={
          groupModalTab === "join"
            ? "Selecteer een groep en vul de geheime code in."
            : "Maak een nieuwe groep en geef meteen een join-code mee."
        }
        size="sm"
        footer={null}
      >
        <div className="inline-flex rounded-full border border-white/10 bg-slate-900/80 p-1">
          <button
            type="button"
            onClick={() => setGroupModalTab("join")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              groupModalTab === "join"
                ? "bg-axoft-500 text-slate-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Joinen
          </button>
          <button
            type="button"
            onClick={() => setGroupModalTab("create")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              groupModalTab === "create"
                ? "bg-axoft-500 text-slate-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Maken
          </button>
        </div>

        {groupModalTab === "join" ? (
          <div className="space-y-3">
            <select
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-axoft-400"
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
              onChange={(event) => setJoinCodeDraft(event.target.value)}
              placeholder="Geheime code"
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400"
            />
            <button
              type="button"
              onClick={() => void handleJoinGroup()}
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
              onClick={() => void handleCreateGroup()}
              disabled={busy}
              className="w-full rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
            >
              {busy ? "Bezig..." : "Groep maken"}
            </button>
          </div>
        )}
      </Modal>

      <Modal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title="Profiel aanpassen"
        description="Werk je naam bij voor je account en dashboard."
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
            onClick={() => setProfileModalOpen(false)}
            className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={accountBusy === "profile"}
            className="flex-1 rounded-2xl bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:opacity-60"
          >
            {accountBusy === "profile" ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
