import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DoublesLeaderboardTable } from "../components/DoublesLeaderboardTable";
import { DoublesMatchEditorModal } from "../components/DoublesMatchEditorModal";
import { DoublesMatchForm } from "../components/DoublesMatchForm";
import { DoublesMatchesTable } from "../components/DoublesMatchesTable";
import { Modal } from "../components/Modal";
import { useAppData } from "../context/AppDataContext";
import {
  buildDoublesPlayerLeaderboard,
  buildDoublesSummary,
  buildDoublesTeamLeaderboard,
  calculateDoublesEloSnapshot,
  filterDoublesMatchesByScope,
} from "../lib/doubles";
import type { DoublesMatch } from "../types";

export function DoublesPage() {
  const {
    players,
    doublesMatches,
    seasons,
    currentSeasonId,
    savingDoublesMatch,
    updatingDoublesMatch,
    deletingDoublesMatchId,
    createDoublesMatch,
    updateDoublesMatch,
    deleteDoublesMatch,
  } = useAppData();

  const [selectedScope, setSelectedScope] = useState<"overall" | number>(
    "overall"
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<DoublesMatch | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<DoublesMatch | null>(
    null
  );

  useEffect(() => {
    if (currentSeasonId != null) {
      setSelectedScope(currentSeasonId);
    }
  }, [currentSeasonId]);

  const filteredMatches = useMemo(
    () =>
      [...filterDoublesMatchesByScope(doublesMatches, selectedScope)].sort(
        (a, b) =>
          new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
      ),
    [doublesMatches, selectedScope]
  );

  const doublesEloSnapshot = useMemo(
    () => calculateDoublesEloSnapshot(filteredMatches),
    [filteredMatches]
  );

  const playerLeaderboard = useMemo(
    () => buildDoublesPlayerLeaderboard(filteredMatches, doublesEloSnapshot),
    [filteredMatches, doublesEloSnapshot]
  );

  const teamLeaderboard = useMemo(
    () => buildDoublesTeamLeaderboard(filteredMatches, doublesEloSnapshot),
    [filteredMatches, doublesEloSnapshot]
  );

  const summary = useMemo(
    () => buildDoublesSummary(filteredMatches),
    [filteredMatches]
  );

  const scopeLabel = useMemo(() => {
    if (selectedScope === "overall") {
      return "Alle 2v2-wedstrijden";
    }

    return seasons.find((season) => season.id === selectedScope)?.name ?? "Seizoen";
  }, [seasons, selectedScope]);

  const handleDelete = async () => {
    if (!deleteCandidate) {
      return;
    }

    await deleteDoublesMatch(deleteCandidate.id);
    setDeleteCandidate(null);
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200/80">
            2v2 modus
          </p>
          <h2 className="text-2xl font-semibold text-white">
            Registreer duo's en bouw een doubles leaderboard
          </h2>
          <p className="max-w-2xl text-sm text-slate-400">
            2v2 heeft nu een eigen Elo-systeem. Per potje wordt de teamrating
            bepaald als het gemiddelde van beide spelers, waarna allebei
            dezelfde Elo-delta krijgen bij winst of verlies.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-axoft-200">
            <span>Bekijk</span>
            <select
              value={selectedScope === "overall" ? "overall" : String(selectedScope)}
              onChange={(event) =>
                setSelectedScope(
                  event.target.value === "overall"
                    ? "overall"
                    : Number(event.target.value)
                )
              }
              className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-axoft-400 focus:ring-2 focus:ring-axoft-400/40"
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.id === currentSeasonId
                    ? `${season.name} (huidig)`
                    : season.name}
                </option>
              ))}
              <option value="overall">Totaal</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-axoft-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500"
          >
            <span className="text-lg leading-none">+</span>
            Nieuwe 2v2
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/80">
            Scope
          </p>
          <p className="mt-2 text-xl font-semibold text-white">{scopeLabel}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/80">
            2v2 potjes
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {summary.matches}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/80">
            Actieve spelers
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {summary.activePlayers}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/80">
            Actieve duo's
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {summary.activeTeams}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DoublesLeaderboardTable
          title="Doubles spelers"
          description="Individuele prestaties in 2v2."
          rows={playerLeaderboard.map((entry) => ({
            id: entry.player.id,
            label: entry.player.name,
            rating: entry.rating,
            wins: entry.wins,
            losses: entry.losses,
            matches: entry.matches,
            pointsFor: entry.pointsFor,
            pointsAgainst: entry.pointsAgainst,
            winRate: entry.winRate,
            pointDifferential: entry.pointDifferential,
          }))}
          emptyMessage="Nog geen 2v2-resultaten in deze scope."
        />
        <DoublesLeaderboardTable
          title="Duo leaderboard"
          description="Vaste koppels die het best presteren."
          rows={teamLeaderboard.map((entry) => ({
            id: entry.id,
            label: entry.label,
            subLabel: `${entry.players[0].name} + ${entry.players[1].name}`,
            rating: entry.rating,
            wins: entry.wins,
            losses: entry.losses,
            matches: entry.matches,
            pointsFor: entry.pointsFor,
            pointsAgainst: entry.pointsAgainst,
            winRate: entry.winRate,
            pointDifferential: entry.pointDifferential,
          }))}
          emptyMessage="Nog geen duo's om te ranken."
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">2v2 wedstrijden</h2>
          <p className="text-sm text-slate-400">
            Overzicht van alle geregistreerde duo-potjes binnen de gekozen scope.
          </p>
        </div>

        <DoublesMatchesTable
          matches={filteredMatches}
          matchBreakdowns={doublesEloSnapshot.matchBreakdowns}
          onEdit={(match) => setEditingMatch(match)}
          onDelete={(match) => setDeleteCandidate(match)}
          pendingDeleteId={deletingDoublesMatchId}
        />
      </section>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nieuwe 2v2"
        description="Registreer een teamscore voor twee duo's."
        size="lg"
      >
        <DoublesMatchForm
          players={players}
          onSubmit={async (values) => {
            await createDoublesMatch(values);
            setCreateOpen(false);
          }}
          loading={savingDoublesMatch}
          showHeader={false}
          className="flex flex-col gap-5"
        />
      </Modal>

      <DoublesMatchEditorModal
        open={editingMatch != null}
        match={editingMatch}
        players={players}
        loading={updatingDoublesMatch}
        onClose={() => setEditingMatch(null)}
        onSubmit={updateDoublesMatch}
      />

      <ConfirmDialog
        open={deleteCandidate != null}
        title="2v2 verwijderen?"
        description="Deze 2v2-wedstrijd wordt definitief verwijderd uit het leaderboard."
        confirmLabel="Verwijderen"
        cancelLabel="Annuleren"
        variant="danger"
        loading={deleteCandidate != null && deletingDoublesMatchId === deleteCandidate.id}
        onConfirm={handleDelete}
        onCancel={() => setDeleteCandidate(null)}
      />
    </div>
  );
}
