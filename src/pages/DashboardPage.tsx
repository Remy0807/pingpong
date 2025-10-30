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
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
          <span className="text-xs uppercase tracking-widest text-axoft-300">
            Beste winrate
          </span>
          <h3 className="mt-3 text-xl font-semibold text-white">
            {stats.bestWinRate ? stats.bestWinRate.player.name : "Nog onbekend"}
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            {stats.bestWinRate
              ? `${Math.round(stats.bestWinRate.winRate * 100)}% over ${
                  stats.bestWinRate.matches
                } potjes`
              : "Er zijn eerst gespeelde potjes nodig."}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
          <span className="text-xs uppercase tracking-widest text-axoft-300">
            Meeste potjes
          </span>
          <h3 className="mt-3 text-xl font-semibold text-white">
            {stats.mostMatches ? stats.mostMatches.player.name : "Nog onbekend"}
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            {stats.mostMatches
              ? `${stats.mostMatches.matches} geregistreerde potjes`
              : "Zodra er potjes zijn verschijnt hier een topper."}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
          <span className="text-xs uppercase tracking-widest text-axoft-300">
            Beste saldo
          </span>
          <h3 className="mt-3 text-xl font-semibold text-white">
            {stats.bestDifferential
              ? stats.bestDifferential.player.name
              : "Nog onbekend"}
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            {stats.bestDifferential
              ? `${stats.bestDifferential.pointDifferential >= 0 ? "+" : ""}${
                  stats.bestDifferential.pointDifferential
                } punten saldo`
              : "Zodra er scores zijn verschijnt het saldo."}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,60%),minmax(0,40%)]">
        <Leaderboard players={playersWithSeasonRating} />
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Laatste resultaten
          </h2>
          <MatchesTable matches={recentMatches} />
        </div>
      </section>

      <SeasonOverview seasons={seasons} currentSeasonId={currentSeasonId} />
    </div>
  );
}
