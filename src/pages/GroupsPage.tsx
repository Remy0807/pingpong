import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createGroup,
  getFriends,
  getGroupInvites,
  getGroups,
  inviteToGroup,
  respondToGroupInvite
} from "../lib/api";
import type { FriendEntry, GroupInviteEntry, GroupSummary, GroupRole } from "../types";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

type InviteAction = "accept" | "decline" | "cancel";

type InviteActionState =
  | {
      inviteId: number;
      action: InviteAction;
    }
  | null;

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInviteEntry[]>([]);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteInputs, setInviteInputs] = useState<Record<number, string>>({});
  const [inviteLoadingGroupId, setInviteLoadingGroupId] = useState<number | null>(null);
  const [inviteActionState, setInviteActionState] = useState<InviteActionState>(null);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsResponse, invitesResponse, friendsResponse] = await Promise.all([
        getGroups(),
        getGroupInvites(),
        getFriends()
      ]);
      setGroups(groupsResponse.groups);
      setGroupInvites(invitesResponse.invites);
      setFriends(friendsResponse.friends);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon groepsgegevens niet ophalen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll().catch((err) => console.error(err));
  }, [refreshAll]);

  const handleCreateGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newGroupName.trim();
    if (trimmed.length < 3) {
      setError("Groepsnaam heeft minimaal 3 tekens nodig.");
      return;
    }
    setCreatingGroup(true);
    setError(null);
    try {
      await createGroup({ name: trimmed });
      setNewGroupName("");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon groep niet aanmaken.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const acceptedFriends = useMemo(
    () => friends.filter((friend) => friend.status === "ACCEPTED"),
    [friends]
  );

  const availableFriendsForGroup = useCallback(
    (group: GroupSummary) => {
      const existingMemberIds = new Set(group.members.map((member) => member.user.id));
      return acceptedFriends.filter((friend) => !existingMemberIds.has(friend.user.id));
    },
    [acceptedFriends]
  );

  const canManageGroup = (role: GroupRole | null) =>
    role === "OWNER" || role === "ADMIN";

  const handleInviteSubmit = async (group: GroupSummary) => {
    const target = inviteInputs[group.id]?.trim();
    if (!target) {
      setError("Selecteer een speler om uit te nodigen.");
      return;
    }
    setInviteLoadingGroupId(group.id);
    setError(null);
    try {
      await inviteToGroup(group.id, { username: target });
      setInviteInputs((state) => ({ ...state, [group.id]: "" }));
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uitnodiging versturen mislukt.");
    } finally {
      setInviteLoadingGroupId(null);
    }
  };

  const handleInviteAction = async (invite: GroupInviteEntry, action: InviteAction) => {
    setInviteActionState({ inviteId: invite.id, action });
    setError(null);
    try {
      await respondToGroupInvite(invite.id, action);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uitnodiging bijwerken mislukt.");
    } finally {
      setInviteActionState(null);
    }
  };

  const isInviteActionBusy = (inviteId: number, action: InviteAction) =>
    inviteActionState?.inviteId === inviteId && inviteActionState.action === action;

  const pendingIncomingInvites = groupInvites.filter(
    (invite) => invite.direction === "incoming" && invite.status === "PENDING"
  );

  const pendingOutgoingInvites = groupInvites.filter(
    (invite) => invite.direction === "outgoing" && invite.status === "PENDING"
  );

  const processedInvites = groupInvites.filter(
    (invite) => invite.status !== "PENDING"
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <h2 className="text-xl font-semibold text-white">Nieuwe groep</h2>
        <p className="mt-1 text-sm text-slate-400">
          Start een competitiegroep voor je team of afdeling en nodig vrienden uit.
        </p>
        <form onSubmit={handleCreateGroup} className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            placeholder="Bijv. Axoft HQ"
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
            minLength={3}
            required
          />
          <button
            type="submit"
            disabled={creatingGroup}
            className="inline-flex items-center justify-center rounded-lg bg-axoft-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500 disabled:cursor-not-allowed disabled:bg-axoft-500/60"
          >
            {creatingGroup ? "Aanmaken..." : "Groep aanmaken"}
          </button>
        </form>
      </section>

  {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
          Groepen worden geladen...
        </div>
      ) : (
        <div className="space-y-6">
          {groups.length ? (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Je groepen</h3>
              <div className="grid gap-4 xl:grid-cols-2">
                {groups.map((group) => {
                  const availableFriends = availableFriendsForGroup(group);
                  const canManage = canManageGroup(group.yourRole);
                  return (
                    <article
                      key={group.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                    >
                      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h4 className="text-lg font-semibold text-white">{group.name}</h4>
                          <p className="text-xs uppercase tracking-widest text-slate-500">
                            Eigenaar #{group.ownerId} • Aangemaakt op {formatDateTime(group.createdAt)}
                          </p>
                        </div>
                        {group.yourRole ? (
                          <span className="inline-flex items-center rounded-full border border-axoft-400/40 bg-axoft-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-axoft-200">
                            {group.yourRole === "OWNER"
                              ? "Eigenaar"
                              : group.yourRole === "ADMIN"
                              ? "Beheerder"
                              : "Lid"}
                          </span>
                        ) : null}
                      </header>

                      <div className="mt-4 space-y-2">
                        <p className="text-xs uppercase tracking-widest text-slate-500">Leden</p>
                        <ul className="space-y-2 text-sm text-slate-200">
                          {group.members.map((member) => (
                            <li
                              key={member.id}
                              className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-900/60 px-3 py-2"
                            >
                              <div>
                                <p className="font-semibold text-white">{member.user.username}</p>
                                <p className="text-[11px] text-slate-400">
                                  Lid sinds {formatDateTime(member.joinedAt)}
                                </p>
                              </div>
                              <span className="text-xs uppercase tracking-widest text-slate-500">
                                {member.role}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {canManage ? (
                        <div className="mt-5 space-y-2">
                          <p className="text-xs uppercase tracking-widest text-slate-500">
                            Vriend uitnodigen
                          </p>
                          {availableFriends.length ? (
                            <div className="flex flex-col gap-3 md:flex-row">
                              <select
                                value={inviteInputs[group.id] ?? ""}
                                onChange={(event) =>
                                  setInviteInputs((state) => ({
                                    ...state,
                                    [group.id]: event.target.value
                                  }))
                                }
                                className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-2.5 text-sm text-slate-100 focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
                              >
                                <option value="">Kies een vriend</option>
                                {availableFriends.map((friend) => (
                                  <option key={friend.id} value={friend.user.username}>
                                    {friend.user.username}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleInviteSubmit(group)}
                                disabled={inviteLoadingGroupId === group.id}
                                className="inline-flex items-center justify-center rounded-lg bg-axoft-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500 disabled:cursor-not-allowed disabled:bg-axoft-500/60"
                              >
                                {inviteLoadingGroupId === group.id ? "Versturen..." : "Uitnodigen"}
                              </button>
                            </div>
                          ) : (
                            <p className="rounded-lg border border-dashed border-white/10 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
                              Geen beschikbare vrienden om uit te nodigen. Voeg eerst nieuwe
                              vrienden toe.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
              Nog geen groepen gevonden. Maak er één aan of accepteer een uitnodiging.
            </div>
          )}

          {pendingIncomingInvites.length ? (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Uitnodigingen ontvangen</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {pendingIncomingInvites.map((invite) => (
                  <article
                    key={invite.id}
                    className="rounded-xl border border-white/10 bg-slate-950/50 p-4"
                  >
                    <header className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{invite.group.name}</p>
                        <p className="text-xs text-slate-400">
                          Uitgenodigd door {invite.inviter.username} op{" "}
                          {formatDateTime(invite.createdAt)}
                        </p>
                      </div>
                    </header>
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleInviteAction(invite, "accept")}
                        disabled={isInviteActionBusy(invite.id, "accept")}
                        className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
                      >
                        {isInviteActionBusy(invite.id, "accept") ? "Bezig..." : "Accepteren"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInviteAction(invite, "decline")}
                        disabled={isInviteActionBusy(invite.id, "decline")}
                        className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-rose-400 hover:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400/30 disabled:cursor-not-allowed"
                      >
                        {isInviteActionBusy(invite.id, "decline") ? "Bezig..." : "Weigeren"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {pendingOutgoingInvites.length ? (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Uitnodigingen verstuurd</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {pendingOutgoingInvites.map((invite) => (
                  <article
                    key={invite.id}
                    className="rounded-xl border border-white/10 bg-slate-950/50 p-4"
                  >
                    <header className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{invite.group.name}</p>
                        <p className="text-xs text-slate-400">
                          Naar {invite.invitee.username} op {formatDateTime(invite.createdAt)}
                        </p>
                      </div>
                    </header>
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleInviteAction(invite, "cancel")}
                        disabled={isInviteActionBusy(invite.id, "cancel")}
                        className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-rose-400 hover:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400/30 disabled:cursor-not-allowed"
                      >
                        {isInviteActionBusy(invite.id, "cancel")
                          ? "Bezig..."
                          : "Uitnodiging intrekken"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {processedInvites.length ? (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Verwerkte uitnodigingen</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {processedInvites.map((invite) => (
                  <article
                    key={invite.id}
                    className="rounded-xl border border-white/10 bg-slate-950/40 p-4"
                  >
                    <p className="text-base font-semibold text-white">{invite.group.name}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {invite.direction === "incoming"
                        ? `Uitnodiging van ${invite.inviter.username}`
                        : `Uitnodiging naar ${invite.invitee.username}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      Status {invite.status.toLowerCase()} • bijgewerkt op{" "}
                      {formatDateTime(invite.updatedAt)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
