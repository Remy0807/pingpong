import { useMemo, useState } from "react";
import { PlayerForm } from "../components/PlayerForm";
import { PlayerEditForm } from "../components/PlayerEditForm";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { useAppData } from "../context/AppDataContext";
import type { PlayerStats } from "../types";

const BadgeList = ({ badges }: { badges: string[] }) => {
  if (!badges.length) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {badges.map((badge, index) => (
        <span
          key={`${badge}-${index}`}
          className="rounded-full border border-axoft-500/30 bg-axoft-500/10 px-3 py-1 text-xs font-medium text-axoft-200"
        >
          {badge}
        </span>
      ))}
    </div>
  );
};

export function PlayersPage() {
  const {
    players,
    matches,
    savingPlayer,
    updatingPlayer,
    deletingPlayerId,
    createPlayer,
    updatePlayer,
    deletePlayer
  } = useAppData();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerStats | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlayerStats | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const sortedPlayers = useMemo(
    () =>
      [...players].sort((a, b) => a.player.name.localeCompare(b.player.name, "nl-NL", { sensitivity: "base" })),
    [players]
  );

  const matchesByPlayer = useMemo(() => {
    const map = new Map<number, typeof matches>();
    sortedPlayers.forEach((player) => {
      map.set(player.player.id, []);
    });
    matches.forEach((match) => {
      const listA = map.get(match.playerOneId);
      if (listA) {
        listA.push(match);
      }
      const listB = map.get(match.playerTwoId);
      if (listB) {
        listB.push(match);
      }
    });
    return map;
  }, [matches, sortedPlayers]);

  const filteredPlayers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return sortedPlayers;
    }
    return sortedPlayers.filter((entry) =>
      entry.player.name.toLowerCase().includes(term)
    );
  }, [searchTerm, sortedPlayers]);

  const handleCreate = async (name: string) => {
    await createPlayer(name);
    setCreateOpen(false);
  };

  const handleEdit = async (name: string) => {
    if (!editing) {
      return;
    }
    await updatePlayer(editing.player.id, name);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      return;
    }
    await deletePlayer(confirmDelete.player.id);
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div>
            <h2 className="text-2xl font-semibold text-white">Team overzicht</h2>
            <p className="text-sm text-slate-400">
              Voeg nieuwe collega's toe, hernoem bestaande spelers of verwijder accounts inclusief hun
              gespeelde potjes.
            </p>
          </div>
          <label className="block text-sm text-slate-300">
            <span className="mb-1 block text-xs uppercase tracking-widest text-slate-500">
              Zoeken
            </span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Zoek op spelernaam"
              className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 md:min-w-[260px]"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-axoft-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500"
          >
            <span className="text-lg leading-none">+</span>
            Nieuwe speler
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredPlayers.length ? (
          filteredPlayers.map((entry) => {
            const playerMatches = matchesByPlayer.get(entry.player.id) ?? [];
            const isExpanded = expandedPlayerId === entry.player.id;
            return (
              <article
                key={entry.player.id}
                className="glass-card flex flex-col rounded-2xl border border-white/10 p-5"
              >
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{entry.player.name}</h3>
                    <p className="text-xs uppercase tracking-widest text-axoft-200/80">
                      {entry.matches} potjes - {entry.wins} gewonnen - {entry.losses} verloren
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(entry)}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/30"
                    >
                      Bewerken
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(entry)}
                      className="rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:border-rose-400 hover:text-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400/40"
                      disabled={deletingPlayerId === entry.player.id}
                    >
                      {deletingPlayerId === entry.player.id ? "Verwijderen..." : "Verwijder"}
                    </button>
                  </div>
                </header>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
                  <div>
                    <dt className="text-xs uppercase tracking-widest text-slate-500">Win%</dt>
                    <dd className="text-base font-semibold text-emerald-200">
                      {entry.matches ? `${Math.round(entry.winRate * 100)}%` : "n.v.t."}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-widest text-slate-500">Saldo</dt>
                    <dd
                      className={`text-base font-semibold ${
                        entry.pointDifferential >= 0 ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {entry.pointDifferential >= 0 ? "+" : ""}
                      {entry.pointDifferential}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-widest text-slate-500">Punten voor</dt>
                    <dd className="text-base font-semibold text-slate-100">{entry.pointsFor}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-widest text-slate-500">Punten tegen</dt>
                    <dd className="text-base font-semibold text-slate-100">{entry.pointsAgainst}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>Titels: {entry.championships}</span>
                  <span>Huidige reeks: {entry.currentStreak}</span>
                  <span>Langste reeks: {entry.longestStreak}</span>
                </div>
                <BadgeList badges={entry.badges} />

                <button
                  type="button"
                  onClick={() =>
                    setExpandedPlayerId(isExpanded ? null : entry.player.id)
                  }
                  className="mt-5 inline-flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-axoft-400 hover:text-axoft-100 focus:outline-none focus:ring-2 focus:ring-axoft-500/30"
                >
                  <span>Wedstrijden {isExpanded ? "verbergen" : "bekijken"}</span>
                  <span>{isExpanded ? "-" : "+"}</span>
                </button>

                {isExpanded ? (
                  <div className="mt-4 space-y-2 overflow-hidden rounded-xl border border-white/5 bg-slate-950/40 p-3 text-xs text-slate-200">
                    {playerMatches.length ? (
                      playerMatches.slice(0, 6).map((match) => {
                        const opponent =
                          match.playerOneId === entry.player.id ? match.playerTwo : match.playerOne;
                        const scored =
                          match.playerOneId === entry.player.id
                            ? match.playerOnePoints
                            : match.playerTwoPoints;
                        const conceded =
                          match.playerOneId === entry.player.id
                            ? match.playerTwoPoints
                            : match.playerOnePoints;
                        const won = match.winnerId === entry.player.id;
                        return (
                          <div
                            key={match.id}
                            className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-900/60 px-3 py-2"
                          >
                            <div>
                              <p className="font-semibold text-white">{opponent.name}</p>
                              <p className="text-[10px] uppercase tracking-widest text-slate-400">
                                {new Date(match.playedAt).toLocaleDateString("nl-NL", {
                                  day: "2-digit",
                                  month: "short"
                                })}{" "}
                                - {won ? "Gewonnen" : "Verloren"} - {match.season?.name ?? "Seizoen onbekend"}
                              </p>
                            </div>
                            <div
                              className={`text-sm font-semibold ${
                                won ? "text-emerald-300" : "text-rose-300"
                              }`}
                            >
                              {won ? "+" : "-"} {scored} - {conceded}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center text-slate-400">
                        Nog geen wedstrijden geregistreerd voor deze speler.
                      </p>
                    )}
                    {playerMatches.length > 6 ? (
                      <p className="text-center text-[11px] text-slate-500">
                        +{playerMatches.length - 6} extra wedstrijden
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="glass-card col-span-full rounded-2xl border border-white/10 p-6 text-center text-sm text-slate-400">
            {sortedPlayers.length
              ? "Geen spelers gevonden. Pas je zoekopdracht aan of voeg een nieuwe speler toe."
              : "Nog geen spelers toegevoegd. Gebruik de knop hierboven om het team te vullen."}
          </div>
        )}
      </section>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nieuwe speler toevoegen"
        description="Registreer een collega zodat we diens resultaten kunnen bijhouden."
        size="sm"
      >
        <PlayerForm
          onCreate={handleCreate}
          loading={savingPlayer}
          showHeader={false}
          className="flex flex-col gap-4"
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Speler bewerken"
        description="Pas de naam van de speler aan. Historische resultaten blijven gekoppeld."
        size="sm"
      >
        {editing ? (
          <PlayerEditForm
            initialName={editing.player.name}
            onSubmit={handleEdit}
            loading={updatingPlayer}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={Boolean(confirmDelete && deletingPlayerId === confirmDelete.player.id)}
        title="Speler verwijderen"
        description="Deze speler en alle bijbehorende wedstrijden worden definitief verwijderd."
        confirmLabel="Verwijderen"
        body={
          confirmDelete ? (
            <p>
              Weet je zeker dat je <span className="font-semibold text-white">{confirmDelete.player.name}</span>{" "}
              wilt verwijderen? Alle potjes waarbij deze speler betrokken is verdwijnen uit de geschiedenis.
            </p>
          ) : null
        }
      />
    </div>
  );
}
