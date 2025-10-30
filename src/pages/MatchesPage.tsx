import { useMemo, useState } from "react";
import { MatchesTable } from "../components/MatchesTable";
import { MatchEditorModal } from "../components/MatchEditorModal";
import { MatchForm } from "../components/MatchForm";
import { PlayerForm } from "../components/PlayerForm";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  MatchFilters,
  type MatchFilters as MatchFiltersType,
} from "../components/MatchFilters";
import { useAppData } from "../context/AppDataContext";
import type { Match } from "../types";

export function MatchesPage() {
  const {
    players,
    matches,
    seasons,
    savingPlayer,
    savingMatch,
    updatingMatch,
    deletingMatchId,
    createPlayer,
    createMatch,
    updateMatch,
    deleteMatch,
  } = useAppData();

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [createPlayerOpen, setCreatePlayerOpen] = useState(false);
  const [createMatchOpen, setCreateMatchOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Match | null>(null);

  const [filters, setFilters] = useState<MatchFiltersType>({});

  const filteredAndSortedMatches = useMemo(() => {
    return [...matches]
      .filter((match) => {
        if (filters.player) {
          if (
            match.playerOne.id !== filters.player &&
            match.playerTwo.id !== filters.player
          ) {
            return false;
          }
        }

        if (filters.season && match.season?.id !== filters.season) {
          return false;
        }

        if (filters.dateFrom) {
          const matchDate = new Date(match.playedAt);
          const fromDate = new Date(filters.dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (matchDate < fromDate) {
            return false;
          }
        }

        if (filters.dateTo) {
          const matchDate = new Date(match.playedAt);
          const toDate = new Date(filters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (matchDate > toDate) {
            return false;
          }
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
      );
  }, [matches, filters]);

  const handleCreatePlayer = async (name: string) => {
    await createPlayer(name);
    setCreatePlayerOpen(false);
  };

  const handleCreateMatch = async (
    payload: Parameters<typeof createMatch>[0]
  ) => {
    await createMatch(payload);
    setCreateMatchOpen(false);
  };

  const handleDeleteMatch = async () => {
    if (!deleteCandidate) {
      return;
    }
    await deleteMatch(deleteCandidate.id);
    setDeleteCandidate(null);
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">
            Wedstrijden beheren
          </h2>
          <p className="text-sm text-slate-400">
            Registreer nieuwe potjes, pas scores aan of verwijder foutieve
            resultaten. Alles wordt direct doorgevoerd in de statistieken.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setCreateMatchOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-axoft-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500"
          >
            <span className="text-lg leading-none">+</span>
            Nieuw potje
          </button>
          <button
            type="button"
            onClick={() => setCreatePlayerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-axoft-400 hover:text-axoft-100 focus:outline-none focus:ring-2 focus:ring-axoft-500/30"
          >
            <span className="text-lg leading-none">+</span>
            Nieuwe speler
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <MatchFilters
          players={players}
          seasons={seasons}
          filters={filters}
          onChange={setFilters}
        />
        <MatchesTable
          matches={filteredAndSortedMatches}
          onEdit={(match) => setEditingMatch(match)}
          onDelete={(match) => setDeleteCandidate(match)}
          pendingDeleteId={deletingMatchId}
        />
      </section>

      <MatchEditorModal
        open={Boolean(editingMatch)}
        match={editingMatch}
        players={players}
        loading={updatingMatch}
        onClose={() => setEditingMatch(null)}
        onSubmit={updateMatch}
      />

      <Modal
        open={createPlayerOpen}
        onClose={() => setCreatePlayerOpen(false)}
        title="Nieuwe speler toevoegen"
        description="Registreer een teamgenoot voordat je een potje met hem of haar opslaat."
        size="sm"
      >
        <PlayerForm
          onCreate={handleCreatePlayer}
          loading={savingPlayer}
          showHeader={false}
          className="flex flex-col gap-4"
        />
      </Modal>

      <Modal
        open={createMatchOpen}
        onClose={() => setCreateMatchOpen(false)}
        title="Nieuw potje registreren"
        description="Noteer de wedstrijdgegevens. Statistieken voor alle spelers worden meteen bijgewerkt."
        size="lg"
      >
        <MatchForm
          players={players}
          onSubmit={handleCreateMatch}
          loading={savingMatch}
          showHeader={false}
          className="flex flex-col gap-5"
          onCancel={() => setCreateMatchOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={handleDeleteMatch}
        loading={Boolean(
          deleteCandidate && deletingMatchId === deleteCandidate.id
        )}
        title="Wedstrijd verwijderen"
        confirmLabel="Verwijderen"
        body={
          deleteCandidate ? (
            <p className="text-sm text-slate-300">
              Weet je zeker dat je de wedstrijd tussen{" "}
              <span className="font-semibold text-white">
                {deleteCandidate.playerOne.name}
              </span>{" "}
              en{" "}
              <span className="font-semibold text-white">
                {deleteCandidate.playerTwo.name}
              </span>{" "}
              wilt verwijderen? Deze actie verwijdert ook de punten uit het
              klassement.
            </p>
          ) : null
        }
      />
    </div>
  );
}
