import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getFriends,
  respondFriendRequest,
  sendFriendRequest
} from "../lib/api";
import type { FriendEntry, FriendsResponse } from "../types";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

type ActionState =
  | {
      friendshipId: number;
      action: "accept" | "decline" | "cancel";
    }
  | null;

export function FriendsPage() {
  const [friendsData, setFriendsData] = useState<FriendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestUsername, setRequestUsername] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [actionState, setActionState] = useState<ActionState>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFriends();
      setFriendsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon vriendenlijst niet ophalen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch((err) => console.error(err));
  }, [refresh]);

  const acceptedFriends = friendsData?.friends ?? [];
  const pendingSent = friendsData?.pending.sent ?? [];
  const pendingReceived = friendsData?.pending.received ?? [];
  const declinedFriends = friendsData?.declined ?? [];

  const hasAnyContent = useMemo(
    () =>
      acceptedFriends.length ||
      pendingSent.length ||
      pendingReceived.length ||
      declinedFriends.length,
    [acceptedFriends.length, pendingReceived.length, pendingSent.length, declinedFriends.length]
  );

  const handleSendRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = requestUsername.trim();
    if (!username) {
      setError("Vul een gebruikersnaam in.");
      return;
    }
    setSendingRequest(true);
    setError(null);
    try {
      await sendFriendRequest({ username });
      setRequestUsername("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Versturen van verzoek mislukt.");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleRespond = async (friendship: FriendEntry, action: "accept" | "decline" | "cancel") => {
    setActionState({ friendshipId: friendship.id, action });
    setError(null);
    try {
      await respondFriendRequest({ friendshipId: friendship.id, action });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bijwerken van verzoek mislukt.");
    } finally {
      setActionState(null);
    }
  };

  const isActionBusy = (friendshipId: number, action: "accept" | "decline" | "cancel") =>
    actionState?.friendshipId === friendshipId && actionState.action === action;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <h2 className="text-xl font-semibold text-white">Vriend toevoegen</h2>
        <p className="mt-1 text-sm text-slate-400">
          Nodig een speler uit via gebruikersnaam. Zodra het verzoek is geaccepteerd kunnen jullie
          elkaar uitnodigen voor groepen.
        </p>
        <form onSubmit={handleSendRequest} className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            placeholder="Gebruikersnaam"
            value={requestUsername}
            onChange={(event) => setRequestUsername(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={sendingRequest}
            className="inline-flex items-center justify-center rounded-lg bg-axoft-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500 disabled:cursor-not-allowed disabled:bg-axoft-500/60"
          >
            {sendingRequest ? "Versturen..." : "Verzoek versturen"}
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
          Vrienden worden geladen...
        </div>
      ) : (
        <div className="space-y-6">
          {!hasAnyContent ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
              Nog geen vrienden gevonden. Stuur een verzoek om te beginnen.
            </div>
          ) : null}

          {acceptedFriends.length ? (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Vrienden</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {acceptedFriends.map((friend) => (
                  <article
                    key={friend.id}
                    className="rounded-xl border border-white/10 bg-slate-950/50 p-4"
                  >
                    <header className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{friend.user.username}</p>
                        {friend.user.email ? (
                          <p className="text-xs text-slate-400">{friend.user.email}</p>
                        ) : null}
                      </div>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                        Vrienden sinds {formatDate(friend.updatedAt)}
                      </span>
                    </header>
                    <p className="mt-4 text-xs text-slate-500">
                      Laatste update: {formatDate(friend.updatedAt)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {pendingReceived.length ? (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Verzoeken ontvangen</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {pendingReceived.map((friend) => (
                  <article
                    key={friend.id}
                    className="rounded-xl border border-white/10 bg-slate-950/50 p-4"
                  >
                    <header className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{friend.user.username}</p>
                        <p className="text-xs text-slate-400">
                          Verzoek op {formatDate(friend.createdAt)}
                        </p>
                      </div>
                    </header>
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleRespond(friend, "accept")}
                        disabled={isActionBusy(friend.id, "accept")}
                        className="inline-flex flex-1 items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
                      >
                        {isActionBusy(friend.id, "accept") ? "Bezig..." : "Accepteren"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespond(friend, "decline")}
                        disabled={isActionBusy(friend.id, "decline")}
                        className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-rose-400 hover:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400/30 disabled:cursor-not-allowed"
                      >
                        {isActionBusy(friend.id, "decline") ? "Bezig..." : "Weigeren"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {pendingSent.length ? (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Verzoeken verstuurd</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {pendingSent.map((friend) => (
                  <article
                    key={friend.id}
                    className="rounded-xl border border-white/10 bg-slate-950/50 p-4"
                  >
                    <header className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{friend.user.username}</p>
                        <p className="text-xs text-slate-400">
                          Verstuurd op {formatDate(friend.createdAt)}
                        </p>
                      </div>
                    </header>
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleRespond(friend, "cancel")}
                        disabled={isActionBusy(friend.id, "cancel")}
                        className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-rose-400 hover:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400/30 disabled:cursor-not-allowed"
                      >
                        {isActionBusy(friend.id, "cancel") ? "Bezig..." : "Verzoek intrekken"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {declinedFriends.length ? (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Geweigerd</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {declinedFriends.map((friend) => (
                  <article
                    key={friend.id}
                    className="rounded-xl border border-white/10 bg-slate-950/40 p-4"
                  >
                    <p className="text-base font-semibold text-white">{friend.user.username}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Laatste status: {friend.status.toLowerCase()} ({formatDate(friend.updatedAt)})
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
