import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { BadgeLegend } from "../components/BadgeLegend";
import { DoublesLeaderboardTable } from "../components/DoublesLeaderboardTable";
import { Leaderboard, type LeaderboardEntry } from "../components/Leaderboard";
import { MatchesTable } from "../components/MatchesTable";
import { SeasonOverview } from "../components/SeasonOverview";
import { SeasonHighlightCard } from "../components/SeasonHighlightCard";
import { useAppData } from "../context/AppDataContext";
import {
  buildDoublesPlayerLeaderboard,
  buildDoublesSummary,
  buildDoublesTeamLeaderboard,
  calculateDoublesEloSnapshot,
  filterDoublesMatchesByScope,
} from "../lib/doubles";
import { buildMatchInsights, isBlowoutMatch } from "../lib/matchInsights";

function useCountUp(target: number, duration = 650) {
  const [value, setValue] = useState(target);
  const latestValueRef = useRef(target);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      latestValueRef.current = target;
      return;
    }

    const from = latestValueRef.current;
    const to = target;
    if (from === to) {
      return;
    }

    let frameId = 0;
    let startedAt = 0;

    const step = (now: number) => {
      if (!startedAt) {
        startedAt = now;
      }
      const progress = Math.min((now - startedAt) / duration, 1);
      const next = Math.round(from + (to - from) * progress);
      setValue(next);
      latestValueRef.current = next;

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      } else {
        setValue(to);
        latestValueRef.current = to;
      }
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [target, duration]);

  return value;
}

type AchievementEvent = {
  id: string;
  at: string;
  title: string;
  detail: string;
  tone: "axoft" | "emerald" | "amber" | "rose";
};

export function DashboardPage() {
  const { players, matches, doublesMatches, seasons, currentSeasonId } =
    useAppData();

  const [selectedScope, setSelectedScope] = useState<"overall" | number>(
    "overall",
  );
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

  const seasonMatches = useMemo(() => {
    if (typeof selectedScope !== "number") {
      return [];
    }
    return matches
      .filter((match) => match.season?.id === selectedScope)
      .sort(
        (a, b) =>
          new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime(),
      );
  }, [matches, selectedScope]);

  const ratingTrends = useMemo(() => {
    if (typeof selectedScope !== "number") {
      return new Map<number, number[]>();
    }

    const BASE_RATING = 1000;
    const K = 32;

    const playerRatings = new Map<number, number>();
    const history = new Map<number, number[]>();

    const calculateDelta = (Ra: number, Rb: number, scoreA: number) => {
      const expectedA = 1 / (1 + 10 ** ((Rb - Ra) / 400));
      return Math.round(K * (scoreA - expectedA));
    };

    seasonMatches.forEach((match) => {
      const p1 = match.playerOneId;
      const p2 = match.playerTwoId;

      const currentRatingOne = playerRatings.get(p1) ?? BASE_RATING;
      const currentRatingTwo = playerRatings.get(p2) ?? BASE_RATING;

      const scoreOne = match.winnerId === p1 ? 1 : 0;
      const scoreTwo = 1 - scoreOne;

      const deltaOne =
        match.playerOneEloDelta ??
        calculateDelta(currentRatingOne, currentRatingTwo, scoreOne);
      const deltaTwo =
        match.playerTwoEloDelta ??
        calculateDelta(currentRatingTwo, currentRatingOne, scoreTwo);

      const nextRatingOne = currentRatingOne + deltaOne;
      const nextRatingTwo = currentRatingTwo + deltaTwo;

      if (!history.has(p1)) {
        history.set(p1, [currentRatingOne]);
      }
      if (!history.has(p2)) {
        history.set(p2, [currentRatingTwo]);
      }

      history.get(p1)!.push(nextRatingOne);
      history.get(p2)!.push(nextRatingTwo);

      playerRatings.set(p1, nextRatingOne);
      playerRatings.set(p2, nextRatingTwo);
    });

    return history;
  }, [seasonMatches, selectedScope]);

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
      ratingTrend: ratingTrends.get(standing.player.id),
    }));
  }, [players, seasons, selectedScope, ratingTrends]);

  const seasonHighlight = useMemo(() => {
    if (typeof selectedScope !== "number") {
      return null;
    }
    if (!seasonMatches.length) {
      return null;
    }

    return seasonMatches.reduce<{
      match: (typeof seasonMatches)[number];
      total: number;
    } | null>((best, match) => {
      const total = match.playerOnePoints + match.playerTwoPoints;
      if (!best || total > best.total) {
        return { match, total };
      }
      return best;
    }, null);
  }, [seasonMatches, selectedScope]);

  const stats = useMemo(() => {
    const activePlayers = leaderboardEntries.filter(
      (entry) => entry.matches > 0,
    );
    const bestWinRate = activePlayers.length
      ? [...activePlayers].sort((a, b) => b.winRate - a.winRate)[0]
      : undefined;
    const mostMatches = leaderboardEntries.length
      ? [...leaderboardEntries].sort((a, b) => b.matches - a.matches)[0]
      : undefined;
    const bestDifferential = leaderboardEntries.length
      ? [...leaderboardEntries].sort(
          (a, b) => b.pointDifferential - a.pointDifferential,
        )[0]
      : undefined;

    return { bestWinRate, mostMatches, bestDifferential };
  }, [leaderboardEntries]);

  const recentMatches = useMemo(
    () =>
      [...matches]
        .sort(
          (a, b) =>
            new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime(),
        )
        .slice(0, 5),
    [matches],
  );

  const scopedDoublesMatches = useMemo(
    () =>
      [...filterDoublesMatchesByScope(doublesMatches, selectedScope)].sort(
        (a, b) =>
          new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime(),
      ),
    [doublesMatches, selectedScope],
  );

  const doublesEloSnapshot = useMemo(
    () => calculateDoublesEloSnapshot(scopedDoublesMatches),
    [scopedDoublesMatches],
  );

  const doublesPlayerLeaderboard = useMemo(
    () =>
      buildDoublesPlayerLeaderboard(scopedDoublesMatches, doublesEloSnapshot).slice(0, 5),
    [scopedDoublesMatches, doublesEloSnapshot],
  );

  const doublesTeamLeaderboard = useMemo(
    () =>
      buildDoublesTeamLeaderboard(scopedDoublesMatches, doublesEloSnapshot).slice(0, 5),
    [scopedDoublesMatches, doublesEloSnapshot],
  );

  const doublesSummary = useMemo(
    () => buildDoublesSummary(scopedDoublesMatches),
    [scopedDoublesMatches],
  );

  const achievementEvents = useMemo<AchievementEvent[]>(() => {
    if (!matches.length) {
      return [];
    }

    const events: AchievementEvent[] = [];
    const sortedAsc = [...matches].sort(
      (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime(),
    );
    const nameById = new Map(
      players.map((entry) => [entry.player.id, entry.player.name]),
    );
    const streakByPlayer = new Map<number, number>();
    const unlockedMilestones = new Set<string>();
    const firstBlowoutByWinner = new Set<number>();
    const insightsByMatch = buildMatchInsights(matches);

    sortedAsc.forEach((match) => {
      const winnerId = match.winnerId;
      const loserId =
        winnerId === match.playerOneId ? match.playerTwoId : match.playerOneId;
      const winnerName = nameById.get(winnerId) ?? `Speler ${winnerId}`;
      const loserName = nameById.get(loserId) ?? `Speler ${loserId}`;

      const nextWinnerStreak = (streakByPlayer.get(winnerId) ?? 0) + 1;
      streakByPlayer.set(winnerId, nextWinnerStreak);
      streakByPlayer.set(loserId, 0);

      const streakMilestone =
        nextWinnerStreak === 5 ? 5 : nextWinnerStreak === 3 ? 3 : null;
      if (streakMilestone != null) {
        const milestoneKey = `${winnerId}-${streakMilestone}`;
        if (!unlockedMilestones.has(milestoneKey)) {
          unlockedMilestones.add(milestoneKey);
          events.push({
            id: `streak-${match.id}`,
            at: match.playedAt,
            title: `${winnerName} bereikt ${streakMilestone} op rij`,
            detail: `Streak mijlpaal tegen ${loserName}.`,
            tone: "emerald",
          });
        }
      }

      if (isBlowoutMatch(match) && !firstBlowoutByWinner.has(winnerId)) {
        firstBlowoutByWinner.add(winnerId);
        events.push({
          id: `blowout-${match.id}`,
          at: match.playedAt,
          title: `${winnerName} pakt eerste 11-0`,
          detail: `${winnerName} versloeg ${loserName} met 11-0.`,
          tone: "rose",
        });
      }

      const insight = insightsByMatch.get(match.id);
      if (insight?.isUpset && insight.upsetDiff != null) {
        events.push({
          id: `upset-${match.id}`,
          at: match.playedAt,
          title: `Upset win voor ${winnerName}`,
          detail: `${loserName} had ${insight.upsetDiff} Elo voordeel.`,
          tone: "amber",
        });
      }
    });

    return events
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  }, [matches, players]);

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

  const bestWinRatePercent = stats.bestWinRate
    ? Math.round(stats.bestWinRate.winRate * 100)
    : 0;
  const mostMatchesCount = stats.mostMatches?.matches ?? 0;
  const bestDifferentialValue = stats.bestDifferential?.pointDifferential ?? 0;

  const animatedBestWinRate = useCountUp(bestWinRatePercent);
  const animatedMostMatches = useCountUp(mostMatchesCount);
  const animatedBestDifferential = useCountUp(bestDifferentialValue);

  return (
    <div className="flex flex-col gap-8">
      <section className="dashboard-stats-grid grid gap-4 md:grid-cols-3">
        <div className="dashboard-stat-card rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-axoft-300">
              Beste winrate
            </span>
            {stats.bestWinRate && (
              <span className="rounded-full bg-axoft-500/15 px-2 py-0.5 text-xs font-medium text-axoft-200">
                {animatedBestWinRate}%
              </span>
            )}
          </div>
          <h3 className="mt-2 md:mt-3 text-lg md:text-xl font-semibold text-white truncate">
            {stats.bestWinRate ? stats.bestWinRate.player.name : "Nog onbekend"}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Winrate teller:{" "}
            <span className="font-semibold text-axoft-200">
              {stats.bestWinRate ? `${animatedBestWinRate}%` : "—"}
            </span>
          </p>
        </div>
        <div className="dashboard-stat-card rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-axoft-300">
              Meeste potjes
            </span>
            {stats.mostMatches && (
              <span className="rounded-full bg-axoft-500/15 px-2 py-0.5 text-xs font-medium text-axoft-200">
                {animatedMostMatches}×
              </span>
            )}
          </div>
          <h3 className="mt-2 md:mt-3 text-lg md:text-xl font-semibold text-white truncate">
            {stats.mostMatches ? stats.mostMatches.player.name : "Nog onbekend"}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Potjes teller:{" "}
            <span className="font-semibold text-axoft-200">
              {stats.mostMatches ? `${animatedMostMatches}` : "—"}
            </span>
          </p>
        </div>
        <div className="dashboard-stat-card rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-axoft-300">
              Beste saldo
            </span>
            {stats.bestDifferential && (
              <span className="rounded-full bg-axoft-500/15 px-2 py-0.5 text-xs font-medium text-axoft-200">
                {animatedBestDifferential >= 0 ? "+" : ""}
                {animatedBestDifferential}
              </span>
            )}
          </div>
          <h3 className="mt-2 md:mt-3 text-lg md:text-xl font-semibold text-white truncate">
            {stats.bestDifferential
              ? stats.bestDifferential.player.name
              : "Nog onbekend"}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Saldo teller:{" "}
            <span className="font-semibold text-axoft-200">
              {stats.bestDifferential
                ? `${animatedBestDifferential >= 0 ? "+" : ""}${animatedBestDifferential}`
                : "—"}
            </span>
          </p>
        </div>
      </section>

      {/* <section className="glass-card rounded-2xl border border-white/10 bg-slate-950/45 p-5 md:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-axoft-200/80">
              Live feed
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Achievement feed
            </h2>
            <p className="text-sm text-slate-400">
              Recente mijlpalen, upset wins en opvallende momenten.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
            Laatste 8
          </span>
        </div>

        {!achievementEvents.length ? (
          <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-slate-950/30 p-4 text-sm text-slate-400">
            Nog geen achievement events. Speel meer wedstrijden om de feed te vullen.
          </div>
        ) : (
          <ol className="mt-4 grid gap-2">
            {achievementEvents.map((event) => {
              const toneClass =
                event.tone === "emerald"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                  : event.tone === "amber"
                    ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                    : event.tone === "rose"
                      ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
                      : "border-axoft-400/30 bg-axoft-500/10 text-axoft-100";

              return (
                <li
                  key={event.id}
                  className={`rounded-xl border p-3 ${toneClass}`}
                >
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm font-semibold">{event.title}</p>
                    <p className="text-[11px] uppercase tracking-[0.25em] opacity-90">
                      {new Date(event.at).toLocaleDateString("nl-NL", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="mt-1 text-xs opacity-90">{event.detail}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section> */}

      <div className="md:hidden">
        <details className="glass-card rounded-xl p-4" open>
          <summary className="cursor-pointer text-lg font-semibold text-white">
            Laatste resultaten
          </summary>
          <div className="mt-4">
            <MatchesTable matches={recentMatches} contextMatches={matches} />
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
          <div>
            <h2 className="text-lg font-semibold text-white">
              Laatste resultaten
            </h2>
            <MatchesTable matches={recentMatches} contextMatches={matches} />
          </div>
          {seasonHighlight ? (
            <SeasonHighlightCard
              match={seasonHighlight.match}
              subtitle={`Meeste punten (${seasonHighlight.total} totaal)`}
            />
          ) : null}
          <BadgeLegend />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              2v2 leaderboard
            </h2>
            <p className="text-sm text-slate-400">
              {selectedScope === "overall"
                ? "Alle 2v2-wedstrijden"
                : `2v2 in ${selectedSeason?.name ?? "het gekozen seizoen"}`}
              . {doublesSummary.matches} 2v2-potjes, {doublesSummary.activePlayers} spelers en{" "}
              {doublesSummary.activeTeams} duo&apos;s actief.
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <DoublesLeaderboardTable
            title="Beste doubles spelers"
            description="Individuele prestaties in teamwedstrijden."
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
            title="Beste duo's"
            description="Koppels die samen het meeste rendement halen."
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
            emptyMessage="Nog geen duo's om te ranken."
          />
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

      {seasonHighlight ? (
        <div className="md:hidden">
          <details className="glass-card rounded-xl p-4">
            <summary className="cursor-pointer text-lg font-semibold text-white">
              Match van het seizoen
            </summary>
            <div className="mt-4">
              <SeasonHighlightCard
                match={seasonHighlight.match}
                subtitle={`Meeste punten (${seasonHighlight.total} totaal)`}
              />
            </div>
          </details>
        </div>
      ) : null}

      <div className="md:hidden">
        <details className="glass-card rounded-xl p-4">
          <summary className="cursor-pointer text-lg font-semibold text-white">
            Badges uitgelegd
          </summary>
          <div className="mt-4">
            <BadgeLegend />
          </div>
        </details>
      </div>
    </div>
  );
}
