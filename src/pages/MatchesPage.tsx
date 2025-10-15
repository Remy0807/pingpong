import { useMemo, useState } from "react";
import { MatchesTable } from "../components/MatchesTable";
import { MatchEditorModal } from "../components/MatchEditorModal";
import { MatchForm } from "../components/MatchForm";
import { PlayerForm } from "../components/PlayerForm";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useAppData } from "../context/AppDataContext";
import type { Match } from "../types";

export function MatchesPage() {
  const {
    players,
    matches,
    savingPlayer,
    savingMatch,
    updatingMatch,
    deletingMatchId,
    createPlayer,
    createMatch,
    updateMatch,
    deleteMatch
  } = useAppData();

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [createPlayerOpen, setCreatePlayerOpen] = useState(false);
  const [createMatchOpen, setCreateMatchOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Match | null>(null);

  const sortedMatches = useMemo(
    () =>
      [...matches].sort(
        (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
      ),
    [matches]
  );

  const handleCreatePlayer = async (name: string) => {
    await createPlayer(name);
    setCreatePlayerOpen(false);
  };

  const handleCreateMatch = async (payload: Parameters<typeof createMatch>[0]) => {
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

  const mobileActionsVisible =
    !createMatchOpen && !createPlayerOpen && !deleteCandidate && !editingMatch;

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Wedstrijden beheren</h2>
          <p className="text-sm text-slate-400">
            Registreer nieuwe potjes, pas scores aan of verwijder foutieve resultaten. Alles wordt
            direct doorgevoerd in de statistieken.
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
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Alle geregistreerde potjes</h3>
            <p className="text-sm text-slate-400">
              Klik op een wedstrijd om de details aan te passen of kies verwijderen om hem volledig te
              verwijderen.
            </p>
          </div>
        </div>
        <MatchesTable
          matches={sortedMatches}
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
        loading={Boolean(deleteCandidate && deletingMatchId === deleteCandidate.id)}
        title="Wedstrijd verwijderen"
        confirmLabel="Verwijderen"
        body={
          deleteCandidate ? (
            <p className="text-sm text-slate-300">
              Weet je zeker dat je de wedstrijd tussen{" "}
              <span className="font-semibold text-white">{deleteCandidate.playerOne.name}</span> en{" "}
              <span className="font-semibold text-white">{deleteCandidate.playerTwo.name}</span> wilt
              verwijderen? Deze actie verwijdert ook de punten uit het klassement.
            </p>
          ) : null
        }
      />

      {mobileActionsVisible ? (
        <div className="fixed bottom-6 left-0 right-0 z-30 px-4 md:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-full border border-white/10 bg-slate-950/95 px-4 py-3 shadow-2xl shadow-axoft-500/10">
            <button
              type="button"
              onClick={() => setCreateMatchOpen(true)}
              className="flex-1 rounded-full bg-axoft-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Nieuw potje
            </button>
            <button
              type="button"
              onClick={() => setCreatePlayerOpen(true)}
              className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
            >
              Speler
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
