import { useMemo } from "react";
import { Leaderboard } from "../components/Leaderboard";
import { MatchesTable } from "../components/MatchesTable";
import { SeasonOverview } from "../components/SeasonOverview";
import { useAppData } from "../context/AppDataContext";

export function DashboardPage() {
  const { players, matches, seasons, currentSeasonId } = useAppData();

  const stats = useMemo(() => {
    const activePlayers = players.filter((entry) => entry.matches > 0);
    const bestWinRate = [...activePlayers].sort(
      (a, b) => b.winRate - a.winRate
    )[0];
    const mostMatches = [...players].sort((a, b) => b.matches - a.matches)[0];
    const bestDifferential = [...players].sort(
      (a, b) => b.pointDifferential - a.pointDifferential
    )[0];

    return { bestWinRate, mostMatches, bestDifferential };
  }, [players]);

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

  // Annotate players with season Elo rating (if available for the current season)
  const playersWithSeasonRating = useMemo(() => {
    const currentSeason =
      seasons.find((s) => s.id === currentSeasonId) ?? seasons[0];
    const ratingMap = new Map<number, number>();
    if (currentSeason) {
      currentSeason.standings.forEach((st) => {
        if (typeof st.rating === "number") {
          ratingMap.set(st.player.id, st.rating);
        }
      });
    }

    return players.map((p) => ({
      ...p,
      rating: ratingMap.get(p.player.id) ?? undefined,
    }));
  }, [players, seasons, currentSeasonId]);

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
        <Leaderboard players={playersWithSeasonRating} />
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
