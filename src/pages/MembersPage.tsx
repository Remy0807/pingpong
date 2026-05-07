import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useAppData } from "../context/AppDataContext";
import { usePortal } from "../context/PortalContext";
import {
  deletePortalGroup,
  getPortalGroup,
  leavePortalGroup,
  removePortalGroupMember,
  updatePortalGroup,
  type PortalGroupDetails,
  type PortalGroupMember,
} from "../lib/api";

type ConfirmState =
  | { kind: "remove"; member: PortalGroupMember }
  | { kind: "leave" }
  | { kind: "delete" }
  | null;

function generateJoinCode() {
  return `PING-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function MembersPage() {
  const { groupMembers } = useAppData();
  const {
    user,
    activeGroup,
    memberships,
    selectOverall,
    refreshSession,
  } = usePortal();

  const [details, setDetails] = useState<PortalGroupDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [joinCodeDraft, setJoinCodeDraft] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied">("idle");
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.groupId === activeGroup?.id) ?? null,
    [activeGroup?.id, memberships]
  );

  const isOwner = (details?.viewerRole ?? activeMembership?.role) === "owner";
  const displayedMembers = details?.members.length ? details.members : groupMembers;

  useEffect(() => {
    if (!activeGroup) {
      setDetails(null);
      setNameDraft("");
      setJoinCodeDraft("");
      return;
    }

    let cancelled = false;
    setLoading(true);

    getPortalGroup(activeGroup.id)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setDetails(result);
        setNameDraft(result.group.name);
        setJoinCodeDraft(result.joinCode ?? "");
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeGroup]);

  useEffect(() => {
    if (copyFeedback !== "copied") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopyFeedback("idle");
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  const refreshGroupDetails = async () => {
    if (!activeGroup) {
      return;
    }
    const result = await getPortalGroup(activeGroup.id);
    setDetails(result);
    setNameDraft(result.group.name);
    setJoinCodeDraft(result.joinCode ?? "");
  };

  const handleSaveGroup = async () => {
    if (!activeGroup || !isOwner) {
      return;
    }
    const nextName = nameDraft.trim();
    if (!nextName) {
      return;
    }

    setSaving(true);
    try {
      await updatePortalGroup(activeGroup.id, {
        name: nextName,
        joinCode: joinCodeDraft.trim() || undefined,
      });
      await refreshGroupDetails();
      await refreshSession();
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateCode = async () => {
    if (!activeGroup || !isOwner) {
      return;
    }

    const nextCode = generateJoinCode();
    setJoinCodeDraft(nextCode);

    setSaving(true);
    try {
      await updatePortalGroup(activeGroup.id, {
        name: nameDraft.trim(),
        joinCode: nextCode,
      });
      await refreshGroupDetails();
      await refreshSession();
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (!joinCodeDraft) {
      return;
    }

    await navigator.clipboard.writeText(joinCodeDraft);
    setCopyFeedback("copied");
  };

  const handleConfirm = async () => {
    if (!activeGroup || !confirmState) {
      return;
    }

    setSaving(true);
    try {
      if (confirmState.kind === "remove") {
        await removePortalGroupMember(activeGroup.id, confirmState.member.uid);
        await refreshGroupDetails();
        await refreshSession();
      } else if (confirmState.kind === "leave") {
        await leavePortalGroup(activeGroup.id);
        await selectOverall();
        await refreshSession();
      } else if (confirmState.kind === "delete") {
        await deletePortalGroup(activeGroup.id);
        await selectOverall();
        await refreshSession();
      }
      setConfirmState(null);
    } finally {
      setSaving(false);
    }
  };

  const confirmTitle =
    confirmState?.kind === "delete"
      ? "Groep verwijderen"
      : confirmState?.kind === "leave"
        ? "Groep verlaten"
        : confirmState?.kind === "remove"
          ? "Lid verwijderen"
          : "";

  const confirmDescription =
    confirmState?.kind === "delete"
      ? `Weet je zeker dat je ${activeGroup?.name ?? "deze groep"} wilt verwijderen? Alle wedstrijden, stand en leden worden mee verwijderd.`
      : confirmState?.kind === "leave"
        ? `Weet je zeker dat je ${activeGroup?.name ?? "deze groep"} wilt verlaten?`
        : confirmState?.kind === "remove"
          ? `Weet je zeker dat je ${confirmState.member.displayName ?? confirmState.member.email ?? "dit lid"} uit ${activeGroup?.name ?? "deze groep"} wilt verwijderen?`
          : undefined;

  if (!activeGroup) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
            Groepsbeheer
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-white">
            Kies eerst een groep
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Open links een groep of kies overal statistieken. Daarna kun je hier
            leden, codes en groepsinstellingen beheren.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/"
              className="rounded-2xl bg-axoft-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400"
            >
              Naar dashboard
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
            Groepsbeheer
          </p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold text-white">
                {details?.group.name ?? activeGroup.name}
              </h2>
              <p className="max-w-2xl text-sm text-slate-300">
                Hier beheer je je groep, zie je alle leden en pas je de
                toegangscode of groepsnaam aan.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                Jouw rol
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {isOwner ? "Beheerder" : "Lid"}
              </p>
              <p className="text-xs text-slate-400">
                {displayedMembers.length} leden zichtbaar
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
            Snelle acties
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Members
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {displayedMembers.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Code
              </p>
              <p className="mt-2 truncate text-lg font-semibold text-white">
                {isOwner ? joinCodeDraft || "—" : "Verborgen"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
                Groepsinstellingen
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Naam en toegangscode
              </h3>
            </div>
            {loading ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                Laden...
              </span>
            ) : null}
          </div>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">
                Groepsnaam
              </span>
              <input
                type="text"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                disabled={!isOwner}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Groepsnaam"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">
                Geheime code
              </span>
              <input
                type="text"
                value={joinCodeDraft}
                onChange={(event) => setJoinCodeDraft(event.target.value)}
                disabled={!isOwner}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-axoft-400 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Join code"
              />
            </label>

            {isOwner ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleCopyCode()}
                  disabled={!joinCodeDraft}
                  className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copyFeedback === "copied" ? "Gekopieerd" : "Code kopiëren"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRegenerateCode()}
                  disabled={saving}
                  className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Nieuwe code
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveGroup()}
                  disabled={saving}
                  className="rounded-2xl bg-axoft-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Opslaan..." : "Instellingen opslaan"}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-4 text-sm text-slate-400">
                Alleen beheerders kunnen de groepsnaam of code wijzigen.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
                Leden
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                {loading ? "Leden laden..." : "Alle groepsleden"}
              </h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.25em] text-slate-300">
              {details?.group.memberCount ?? displayedMembers.length} totaal
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {displayedMembers.length ? (
              displayedMembers.map((member) => {
                const isMe = member.uid === user?.uid;
                return (
                  <div
                    key={member.uid}
                    className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-white">
                          {member.displayName ?? member.email ?? member.uid}
                          {isMe ? " (jij)" : ""}
                        </p>
                        <p className="truncate text-sm text-slate-400">
                          {member.email ?? "Geen e-mailadres"}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                          Gejoined op{" "}
                          {new Date(member.joinedAt).toLocaleDateString("nl-NL", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-3 md:items-end">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                            member.role === "owner"
                              ? "bg-axoft-500/15 text-axoft-100"
                              : "bg-white/5 text-slate-300"
                          }`}
                        >
                          {member.role === "owner" ? "Beheerder" : "Lid"}
                        </span>
                        {isOwner && !isMe ? (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmState({ kind: "remove", member })
                            }
                            className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20"
                          >
                            Verwijderen
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-4 text-sm text-slate-400">
                Nog geen leden om te tonen.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-rose-200">
            Gevaarzone
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            {isOwner ? "Groep verwijderen" : "Groep verlaten"}
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            {isOwner
              ? "Als beheerder kun je de hele groep verwijderen. Alle wedstrijden, standen en leden verdwijnen dan ook."
              : "Je kunt deze groep verlaten als je er niet meer in wilt kijken."}
          </p>
        </div>

        <div className="flex items-center lg:justify-end">
          <button
            type="button"
            onClick={() =>
              setConfirmState(isOwner ? { kind: "delete" } : { kind: "leave" })
            }
            className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
          >
            {isOwner ? "Groep verwijderen" : "Groep verlaten"}
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmState != null}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={
          confirmState?.kind === "delete"
            ? "Verwijderen"
            : confirmState?.kind === "leave"
              ? "Verlaten"
              : "Verwijderen"
        }
        cancelLabel="Annuleren"
        loading={saving}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
}
