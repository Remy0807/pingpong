import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Leaderboard, type LeaderboardEntry } from "../components/Leaderboard";
import { MatchesTable } from "../components/MatchesTable";
import { SeasonOverview } from "../components/SeasonOverview";
import { useAppData } from "../context/AppDataContext";

export function DashboardPage() {
  const { players, matches, seasons, currentSeasonId } = useAppData();

  const [selectedScope, setSelectedScope] = useState<"overall" | number>("overall");
  const initializedScope = useRef(false);

  useEffect(() => {
    if (!initializedScope.current && currentSeasonId != null) {
      setSelectedScope(currentSeasonId);
      initializedScope.current = true;
    }
  }, [currentSeasonId]);

  useEffect(() => {
    if (
      typeof selectedScope === "number" &&
      seasons.length > 0 &&
      seasons.every((season) => season.id !== selectedScope)
    ) {
      setSelectedScope(currentSeasonId ?? "overall");
    }
  }, [currentSeasonId, seasons, selectedScope]);

  const selectedSeason = useMemo(() => {
    if (typeof selectedScope !== "number") {
      return null;
    }
    return seasons.find((season) => season.id === selectedScope) ?? null;
  }, [selectedScope, seasons]);

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
      }));
    }

    const season = seasons.find((season) => season.id === selectedScope);
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
    }));
  }, [players, seasons, selectedScope]);

  const stats = useMemo(() => {
    const activePlayers = leaderboardEntries.filter((entry) => entry.matches > 0);
    const bestWinRate = activePlayers.length
      ? [...activePlayers].sort((a, b) => b.winRate - a.winRate)[0]
      : undefined;
    const mostMatches = leaderboardEntries.length
      ? [...leaderboardEntries].sort((a, b) => b.matches - a.matches)[0]
      : undefined;
    const bestDifferential = leaderboardEntries.length
      ? [...leaderboardEntries].sort(
          (a, b) => b.pointDifferential - a.pointDifferential
        )[0]
      : undefined;

    return { bestWinRate, mostMatches, bestDifferential };
  }, [leaderboardEntries]);

  const recentMatches = useMemo(
    () =>
      [...matches]
        .sort(
          (a, b) =>
            new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
        )
        .slice(0, 5),
    [matches]
  );

  const scopeDescription =
    selectedScope === "overall"
      ? "Alle gespeelde wedstrijden"
      : selectedSeason
        ? `${selectedSeason.matches} ${
            selectedSeason.matches === 1 ? "wedstrijd" : "wedstrijden"
          } in ${selectedSeason.name}`
        : "Geen seizoensgegevens beschikbaar";

  const handleScopeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedScope(value === "overall" ? "overall" : Number(value));
  };

  const selectValue =
    selectedScope === "overall" ? "overall" : String(selectedScope);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-axoft-300">
              Beste winrate
            </span>
            {stats.bestWinRate && (
              <span className="rounded-full bg-axoft-500/15 px-2 py-0.5 text-xs font-medium text-axoft-200">
                {Math.round(stats.bestWinRate.winRate * 100)}%
              </span>
            )}
          </div>
          <h3 className="mt-2 md:mt-3 text-lg md:text-xl font-semibold text-white truncate">
            {stats.bestWinRate ? stats.bestWinRate.player.name : "Nog onbekend"}
          </h3>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-axoft-300">
              Meeste potjes
            </span>
            {stats.mostMatches && (
              <span className="rounded-full bg-axoft-500/15 px-2 py-0.5 text-xs font-medium text-axoft-200">
                {stats.mostMatches.matches}×
              </span>
            )}
          </div>
          <h3 className="mt-2 md:mt-3 text-lg md:text-xl font-semibold text-white truncate">
            {stats.mostMatches ? stats.mostMatches.player.name : "Nog onbekend"}
          </h3>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-axoft-300">
              Beste saldo
            </span>
            {stats.bestDifferential && (
              <span className="rounded-full bg-axoft-500/15 px-2 py-0.5 text-xs font-medium text-axoft-200">
                {stats.bestDifferential.pointDifferential >= 0 ? "+" : ""}
                {stats.bestDifferential.pointDifferential}
              </span>
            )}
          </div>
          <h3 className="mt-2 md:mt-3 text-lg md:text-xl font-semibold text-white truncate">
            {stats.bestDifferential
              ? stats.bestDifferential.player.name
              : "Nog onbekend"}
          </h3>
        </div>
      </section>

      <div className="md:hidden">
        <details className="glass-card rounded-xl p-4" open>
          <summary className="cursor-pointer text-lg font-semibold text-white">
            Laatste resultaten
          </summary>
          <div className="mt-4">
            <MatchesTable matches={recentMatches} />
          </div>
        </details>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,60%),minmax(0,40%)]">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Klassement</h2>
              <p className="text-sm text-slate-400">{scopeDescription}</p>
            </div>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-axoft-200 sm:flex-row sm:items-center">
              <span>Bekijk</span>
              <select
                className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-axoft-400 focus:ring-2 focus:ring-axoft-400/40"
                value={selectValue}
                onChange={handleScopeChange}
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.id === currentSeasonId
                      ? `${season.name} (huidig)`
                      : season.name}
                  </option>
                ))}
                <option value="overall">Totaal (alle seizoenen)</option>
              </select>
            </label>
          </div>
          <Leaderboard entries={leaderboardEntries} />
        </div>
        <div className="hidden md:block space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Laatste resultaten
          </h2>
          <MatchesTable matches={recentMatches} />
        </div>
      </section>

      <div className="md:hidden">
        <details className="glass-card rounded-xl p-4">
          <summary className="cursor-pointer text-lg font-semibold text-white">
            Seizoensoverzicht
          </summary>
          <div className="mt-4">
            <SeasonOverview
              seasons={seasons}
              currentSeasonId={currentSeasonId}
            />
          </div>
        </details>
      </div>

      <div className="hidden md:block">
        <SeasonOverview seasons={seasons} currentSeasonId={currentSeasonId} />
      </div>
    </div>
  );
}
