import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DoublesLeaderboardTable } from "../components/DoublesLeaderboardTable";
import { Leaderboard, type LeaderboardEntry } from "../components/Leaderboard";
import { SeasonOverview } from "../components/SeasonOverview";
import { useAppData } from "../context/AppDataContext";
import { usePortal } from "../context/PortalContext";
import { calculateOverallEloMap, getTierForRating } from "../lib/tiers";
import {
  buildDoublesPlayerLeaderboard,
  buildDoublesSummary,
  buildDoublesTeamLeaderboard,
  calculateDoublesEloSnapshot,
  filterDoublesMatchesByScope,
} from "../lib/doubles";

export function StandingsPage() {
  const { players, matches, doublesMatches, seasons, currentSeasonId } =
    useAppData();
  const { activeGroup } = usePortal();
  const [selectedScope, setSelectedScope] = useState<"overall" | number>(
    "overall",
  );
  const [selectedLeaderboard, setSelectedLeaderboard] = useState<
    "singles" | "doubles"
  >("singles");

  useEffect(() => {
    if (currentSeasonId != null) {
      setSelectedScope(currentSeasonId);
    }
  }, [activeGroup?.id, currentSeasonId]);

  const selectedSeason = useMemo(() => {
    if (typeof selectedScope !== "number") {
      return null;
    }
    return seasons.find((season) => season.id === selectedScope) ?? null;
  }, [selectedScope, seasons]);

  const currentSeason = useMemo(() => {
    if (currentSeasonId == null) {
      return null;
    }
    return seasons.find((season) => season.id === currentSeasonId) ?? null;
  }, [currentSeasonId, seasons]);

  const overallEloMap = useMemo(
    () => calculateOverallEloMap(matches),
    [matches],
  );

  const currentSeasonEloMap = useMemo(() => {
    return new Map<number, number>(
      (currentSeason?.standings ?? []).map((standing) => [
        standing.player.id,
        standing.rating,
      ]),
    );
  }, [currentSeason]);

  const primaryRatingLabel =
    selectedScope === "overall" ? "Overall Elo" : "Seizoens-Elo";
  const secondaryRatingLabel =
    selectedScope === "overall" ? "Seizoens-Elo" : "Overall Elo";

  const leaderboardEntries = useMemo<LeaderboardEntry[]>(() => {
    if (selectedScope === "overall") {
      return players.map((entry) => ({
        player: {
          id: entry.player.id,
          name: entry.player.name,
        },
        wins: entry.wins,
        losses: entry.losses,
        matches: entry.matches,
        pointsFor: entry.pointsFor,
        pointsAgainst: entry.pointsAgainst,
        winRate: entry.winRate,
        pointDifferential: entry.pointDifferential,
        rating: overallEloMap.get(entry.player.id),
        ratingLabel: primaryRatingLabel,
        secondaryRating: currentSeasonEloMap.get(entry.player.id),
        secondaryRatingLabel: secondaryRatingLabel,
        tierLabel: overallEloMap.has(entry.player.id)
          ? getTierForRating(overallEloMap.get(entry.player.id) ?? 0).label
          : undefined,
      }));
    }

    const season = seasons.find((seasonItem) => seasonItem.id === selectedScope);
    if (!season) {
      return [];
    }

    return season.standings.map((standing) => ({
      player: standing.player,
      wins: standing.wins,
      losses: standing.losses,
      matches: standing.matches,
      pointsFor: standing.pointsFor,
      pointsAgainst: standing.pointsAgainst,
      winRate: standing.winRate,
      pointDifferential: standing.pointDifferential,
      rating: standing.rating,
      ratingLabel: primaryRatingLabel,
      secondaryRating: overallEloMap.get(standing.player.id),
      secondaryRatingLabel: secondaryRatingLabel,
      tierLabel: getTierForRating(standing.rating).label,
    }));
  }, [
    players,
    seasons,
    selectedScope,
    overallEloMap,
    currentSeasonEloMap,
    primaryRatingLabel,
    secondaryRatingLabel,
  ]);

  const filteredDoublesMatches = useMemo(
    () =>
      [...filterDoublesMatchesByScope(doublesMatches, selectedScope)].sort(
        (a, b) =>
          new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime(),
      ),
    [doublesMatches, selectedScope],
  );

  const doublesEloSnapshot = useMemo(
    () => calculateDoublesEloSnapshot(filteredDoublesMatches),
    [filteredDoublesMatches],
  );

  const doublesPlayerLeaderboard = useMemo(
    () => buildDoublesPlayerLeaderboard(filteredDoublesMatches, doublesEloSnapshot),
    [filteredDoublesMatches, doublesEloSnapshot],
  );

  const doublesTeamLeaderboard = useMemo(
    () => buildDoublesTeamLeaderboard(filteredDoublesMatches, doublesEloSnapshot),
    [filteredDoublesMatches, doublesEloSnapshot],
  );

  const doublesSummary = useMemo(
    () => buildDoublesSummary(filteredDoublesMatches),
    [filteredDoublesMatches],
  );

  const scopeLabel =
    selectedScope === "overall"
      ? "Totaal over alle seizoenen"
      : selectedSeason?.name ?? "Seizoen";

  const singlesMatchCount =
    selectedScope === "overall" ? matches.length : selectedSeason?.matches ?? 0;

  if (!activeGroup) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
            Standen
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-white">
            Kies eerst een groep
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Standen en seizoenen horen bij een specifieke groep. Selecteer een
            groep in de sidebar om het klassement en de seizoenstand te zien.
          </p>
          <div className="mt-5">
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
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
                Standen
              </p>
              <h2 className="text-3xl font-semibold text-white">
                {activeGroup.name}
              </h2>
              <p className="max-w-2xl text-sm text-slate-300">
                Dit is de plek voor alle ranglijsten en seizoensdetails. Het
                dashboard blijft daardoor rustig en snel.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1 text-xs uppercase tracking-widest text-axoft-200">
                <span>Stand</span>
                <div className="inline-flex rounded-lg border border-white/10 bg-slate-900/70 p-1">
                  <button
                    type="button"
                    onClick={() => setSelectedLeaderboard("singles")}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold normal-case tracking-normal transition ${
                      selectedLeaderboard === "singles"
                        ? "bg-axoft-500 text-slate-950"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    1v1
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLeaderboard("doubles")}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold normal-case tracking-normal transition ${
                      selectedLeaderboard === "doubles"
                        ? "bg-axoft-500 text-slate-950"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    2v2
                  </button>
                </div>
              </div>
              <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-axoft-200">
                <span>Periode</span>
                <select
                  value={selectedScope === "overall" ? "overall" : String(selectedScope)}
                  onChange={(event) =>
                    setSelectedScope(
                      event.target.value === "overall"
                        ? "overall"
                        : Number(event.target.value),
                    )
                  }
                  className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-axoft-400 focus:ring-2 focus:ring-axoft-400/40"
                >
                  <option value="overall">Totaal</option>
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.id === currentSeasonId
                        ? `${season.name} (huidig)`
                        : season.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
            Samenvatting
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {selectedLeaderboard === "singles" ? "1v1 spelers" : "2v2 spelers"}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {selectedLeaderboard === "singles"
                  ? leaderboardEntries.length
                  : doublesSummary.activePlayers}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {selectedLeaderboard === "singles" ? "1v1 potjes" : "2v2 potjes"}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {selectedLeaderboard === "singles"
                  ? singlesMatchCount
                  : doublesSummary.matches}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {selectedLeaderboard === "singles" ? "Scope" : "2v2 duo's"}
              </p>
              <p
                className={`mt-2 font-semibold text-white ${
                  selectedLeaderboard === "singles" ? "text-xl" : "text-3xl"
                }`}
              >
                {selectedLeaderboard === "singles"
                  ? scopeLabel
                  : doublesSummary.activeTeams}
              </p>
            </div>
          </div>
        </div>
      </section>

      {selectedLeaderboard === "singles" ? (
        <Leaderboard entries={leaderboardEntries} />
      ) : (
        <section className="grid gap-6 xl:grid-cols-2">
          <DoublesLeaderboardTable
            title="2v2 spelers"
            description={`Individuele prestaties in ${scopeLabel}.`}
            rows={doublesPlayerLeaderboard.map((entry) => ({
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
            description={`De sterkste vaste duo's in ${scopeLabel}.`}
            rows={doublesTeamLeaderboard.map((entry) => ({
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
            emptyMessage="Nog geen duo's om te tonen."
          />
        </section>
      )}

      <SeasonOverview seasons={seasons} currentSeasonId={currentSeasonId} />
    </div>
  );
}
