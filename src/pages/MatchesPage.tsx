import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

type MatchViewMode = "grouped" | "table";

const monthLabelFormatter = new Intl.DateTimeFormat("nl-NL", {
  month: "long",
  year: "numeric",
});

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

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
  const [viewMode, setViewMode] = useState<MatchViewMode>("grouped");

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

  const groupedMatches = useMemo(() => {
    const byMonth = new Map<
      string,
      {
        label: string;
        matches: Match[];
      }
    >();

    filteredAndSortedMatches.forEach((match) => {
      const playedAt = new Date(match.playedAt);
      const key = `${playedAt.getFullYear()}-${playedAt.getMonth() + 1}`;
      const existing = byMonth.get(key);
      if (existing) {
        existing.matches.push(match);
        return;
      }

      byMonth.set(key, {
        label: capitalize(monthLabelFormatter.format(playedAt)),
        matches: [match],
      });
    });

    return Array.from(byMonth.entries()).map(([key, value]) => ({
      key,
      label: value.label,
      matches: value.matches,
    }));
  }, [filteredAndSortedMatches]);

  const filteredSummary = useMemo(() => {
    const uniquePlayers = new Set<number>();
    let totalPoints = 0;
    let zeroElevenCount = 0;

    filteredAndSortedMatches.forEach((match) => {
      uniquePlayers.add(match.playerOneId);
      uniquePlayers.add(match.playerTwoId);
      totalPoints += match.playerOnePoints + match.playerTwoPoints;

      if (
        (match.playerOnePoints === 11 && match.playerTwoPoints === 0) ||
        (match.playerOnePoints === 0 && match.playerTwoPoints === 11)
      ) {
        zeroElevenCount += 1;
      }
    });

    const avgPoints = filteredAndSortedMatches.length
      ? (totalPoints / filteredAndSortedMatches.length).toFixed(1)
      : "0.0";

    return {
      count: filteredAndSortedMatches.length,
      uniquePlayers: uniquePlayers.size,
      avgPoints,
      zeroElevenCount,
    };
  }, [filteredAndSortedMatches]);

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
          <Link
            to="/doubles"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-axoft-400 hover:text-axoft-100 focus:outline-none focus:ring-2 focus:ring-axoft-500/30"
          >
            Naar 2v2
          </Link>
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
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.3em] text-axoft-200/80">
              Gefilterd
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {filteredSummary.count}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.3em] text-axoft-200/80">
              Spelers
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {filteredSummary.uniquePlayers}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.3em] text-axoft-200/80">
              Gem. punten
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {filteredSummary.avgPoints}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.3em] text-axoft-200/80">
              Uitslag 11-0
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {filteredSummary.zeroElevenCount}
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-white/10 bg-slate-950/50 p-1">
          <button
            type="button"
            onClick={() => setViewMode("grouped")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              viewMode === "grouped"
                ? "bg-axoft-500 text-slate-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Gegroepeerd
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              viewMode === "table"
                ? "bg-axoft-500 text-slate-950"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Tabel
          </button>
        </div>

        {viewMode === "table" ? (
          <MatchesTable
            matches={filteredAndSortedMatches}
            contextMatches={matches}
            onEdit={(match) => setEditingMatch(match)}
            onDelete={(match) => setDeleteCandidate(match)}
            pendingDeleteId={deletingMatchId}
          />
        ) : groupedMatches.length ? (
          <div className="space-y-3">
            {groupedMatches.map((group, index) => (
              <details
                key={group.key}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                open={index === 0}
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {group.label}
                      </h3>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                        {group.matches.length}{" "}
                        {group.matches.length === 1
                          ? "wedstrijd"
                          : "wedstrijden"}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-axoft-200">
                      Open/sluit
                    </span>
                  </div>
                </summary>
                <div className="mt-4">
                  <MatchesTable
                    matches={group.matches}
                    contextMatches={matches}
                    onEdit={(match) => setEditingMatch(match)}
                    onDelete={(match) => setDeleteCandidate(match)}
                    pendingDeleteId={deletingMatchId}
                  />
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl p-6 text-center text-slate-400">
            Geen wedstrijden die aan deze filters voldoen.
          </div>
        )}
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
