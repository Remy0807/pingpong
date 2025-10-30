import { useEffect, useMemo, useState } from "react";
import type { Match, PlayerStats } from "../types";

type HeadToHeadProps = {
  players: PlayerStats[];
  matches: Match[];
};

type PairAggregate = {
  playerAId: number;
  playerBId: number;
  matches: number;
  playerAWins: number;
  playerBWins: number;
  playerAPoints: number;
  playerBPoints: number;
  lastPlayed: string | null;
};

const percentageFormatter = new Intl.NumberFormat("nl-NL", {
  style: "percent",
  maximumFractionDigits: 0
});

const matchDateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const pairKey = (a: number | null, b: number | null) => {
  if (a == null || b == null || a === b) {
    return null;
  }
  const [min, max] = a < b ? [a, b] : [b, a];
  return `${min}-${max}`;
};

export function HeadToHead({ players, matches }: HeadToHeadProps) {
  const [playerAId, setPlayerAId] = useState<number | null>(null);
  const [playerBId, setPlayerBId] = useState<number | null>(null);

  useEffect(() => {
    if (!players.length) {
      setPlayerAId(null);
      setPlayerBId(null);
      return;
    }

    const ids = players.map((p) => p.player.id);
    const defaultA = ids[0];
    const defaultB = ids.find((id) => id !== defaultA) ?? null;

    const nextA = playerAId && ids.includes(playerAId) ? playerAId : defaultA;
    let nextB = playerBId && ids.includes(playerBId) ? playerBId : defaultB;

    if (nextB === nextA) {
      nextB = ids.find((id) => id !== nextA) ?? null;
    }

    setPlayerAId(nextA);
    setPlayerBId(nextB ?? null);
  }, [players, playerAId, playerBId]);

  const playerNameMap = useMemo(() => {
    return new Map(players.map((p) => [p.player.id, p.player.name]));
  }, [players]);

  const pairAggregates = useMemo(() => {
    const aggregates = new Map<string, PairAggregate>();

    matches.forEach((match) => {
      const [minId, maxId] =
        match.playerOneId < match.playerTwoId
          ? [match.playerOneId, match.playerTwoId]
          : [match.playerTwoId, match.playerOneId];
      const key = `${minId}-${maxId}`;
      const entry =
        aggregates.get(key) ??
        ({
          playerAId: minId,
          playerBId: maxId,
          matches: 0,
          playerAWins: 0,
          playerBWins: 0,
          playerAPoints: 0,
          playerBPoints: 0,
          lastPlayed: null
        } as PairAggregate);

      entry.matches += 1;
      entry.lastPlayed =
        !entry.lastPlayed || entry.lastPlayed < match.playedAt ? match.playedAt : entry.lastPlayed;

      const minWon = match.winnerId === entry.playerAId;
      if (minWon) {
        entry.playerAWins += 1;
      } else {
        entry.playerBWins += 1;
      }

      const minPoints =
        match.playerOneId === entry.playerAId ? match.playerOnePoints : match.playerTwoPoints;
      const maxPoints =
        match.playerOneId === entry.playerBId ? match.playerOnePoints : match.playerTwoPoints;

      entry.playerAPoints += minPoints;
      entry.playerBPoints += maxPoints;

      aggregates.set(key, entry);
    });

    return aggregates;
  }, [matches]);

  const selectedPairKey = pairKey(playerAId, playerBId);

  const selectedSummary = useMemo(() => {
    if (!selectedPairKey || playerAId == null || playerBId == null) {
      return null;
    }
    const aggregate = pairAggregates.get(selectedPairKey);
    if (!aggregate) {
      return null;
    }

    const playerAName = playerNameMap.get(playerAId) ?? `Speler ${playerAId}`;
    const playerBName = playerNameMap.get(playerBId) ?? `Speler ${playerBId}`;
    const aIsMin = playerAId === aggregate.playerAId;

    const playerAWins = aIsMin ? aggregate.playerAWins : aggregate.playerBWins;
    const playerBWins = aIsMin ? aggregate.playerBWins : aggregate.playerAWins;
    const playerAPoints = aIsMin ? aggregate.playerAPoints : aggregate.playerBPoints;
    const playerBPoints = aIsMin ? aggregate.playerBPoints : aggregate.playerAPoints;

    return {
      playerAId,
      playerBId,
      playerAName,
      playerBName,
      matches: aggregate.matches,
      playerAWins,
      playerBWins,
      playerAPoints,
      playerBPoints,
      playerALosses: aggregate.matches - playerAWins,
      playerBLosses: aggregate.matches - playerBWins,
      playerAWinRate: aggregate.matches ? playerAWins / aggregate.matches : 0,
      playerBWinRate: aggregate.matches ? playerBWins / aggregate.matches : 0,
      playerAPointDifferential: playerAPoints - playerBPoints,
      lastPlayed: aggregate.lastPlayed
    };
  }, [pairAggregates, playerAId, playerBId, playerNameMap, selectedPairKey]);

  const pairMatches = useMemo(() => {
    if (!playerAId || !playerBId || playerAId === playerBId) {
      return [];
    }
    return matches
      .filter(
        (match) =>
          (match.playerOneId === playerAId && match.playerTwoId === playerBId) ||
          (match.playerOneId === playerBId && match.playerTwoId === playerAId)
      )
      .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
  }, [matches, playerAId, playerBId]);

  const hottestRivalries = useMemo(() => {
    return Array.from(pairAggregates.values())
      .filter((pair) => pair.matches >= 2)
      .sort(
        (a, b) =>
          b.matches - a.matches ||
          (b.lastPlayed ?? "").localeCompare(a.lastPlayed ?? "")
      )
      .slice(0, 6)
      .map((pair) => {
        const playerAName = playerNameMap.get(pair.playerAId) ?? `Speler ${pair.playerAId}`;
        const playerBName = playerNameMap.get(pair.playerBId) ?? `Speler ${pair.playerBId}`;
        const leader =
          pair.playerAWins === pair.playerBWins
            ? "Gelijk op"
            : pair.playerAWins > pair.playerBWins
            ? playerAName
            : playerBName;
        return {
          ...pair,
          playerAName,
          playerBName,
          leader
        };
      });
  }, [pairAggregates, playerNameMap]);

  return (
    <section className="space-y-8">
      <div className="glass-card rounded-2xl p-6">
        <header className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-white">Vergelijk spelers</h2>
            <p className="text-sm text-slate-400">
              Kies twee collega&apos;s om het duelverleden, winpercentages en puntenverdeling te
              zien.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              Speler A
              <select
                value={playerAId ?? ""}
                onChange={(event) => setPlayerAId(Number(event.target.value) || null)}
                className="w-full min-w-[200px] rounded-lg border border-white/10 bg-slate-900/70 px-4 py-2 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/30 transition md:min-w-[180px]"
              >
                <option value="">Kies speler</option>
                {players.map((player) => (
                  <option key={player.player.id} value={player.player.id}>
                    {player.player.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setPlayerAId(playerBId);
                setPlayerBId(playerAId);
              }}
              className="mt-2 inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-axoft-400 hover:text-axoft-100 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 md:mt-0"
              disabled={!playerAId || !playerBId}
            >
              Wissel
            </button>
            <label className="flex flex-col gap-1 text-sm text-slate-200">
              Speler B
              <select
                value={playerBId ?? ""}
                onChange={(event) => setPlayerBId(Number(event.target.value) || null)}
                className="w-full min-w-[200px] rounded-lg border border-white/10 bg-slate-900/70 px-4 py-2 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/30 transition md:min-w-[180px]"
              >
                <option value="">Kies speler</option>
                {players.map((player) => (
                  <option key={player.player.id} value={player.player.id}>
                    {player.player.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {!selectedSummary ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">
            Kies twee verschillende spelers om hun onderlinge historie te bekijken.
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))]">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">Speler A</p>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    {percentageFormatter.format(selectedSummary.playerAWinRate)}
                  </span>
                </div>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  {selectedSummary.playerAName}
                </h3>
                <p className="mt-2 text-sm text-slate-300">
                  {selectedSummary.playerAWins} gewonnen / {selectedSummary.playerALosses} verloren
                </p>
                <p className="text-xs text-slate-500">
                  {selectedSummary.playerAPoints} punten gescoord
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">Speler B</p>
                  <span className="rounded-full bg-axoft-500/10 px-3 py-1 text-xs font-semibold text-axoft-200">
                    {percentageFormatter.format(selectedSummary.playerBWinRate)}
                  </span>
                </div>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  {selectedSummary.playerBName}
                </h3>
                <p className="mt-2 text-sm text-slate-300">
                  {selectedSummary.playerBWins} gewonnen / {selectedSummary.playerBLosses} verloren
                </p>
                <p className="text-xs text-slate-500">
                  {selectedSummary.playerBPoints} punten gescoord
                </p>
              </div>

              <div className="md:col-span-2">
                <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-5 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Potjes</p>
                    <p className="mt-1 text-2xl font-semibold text-white">
                      {selectedSummary.matches}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Laatste duel</p>
                    <p className="mt-1 text-lg font-medium text-slate-200">
                      {selectedSummary.lastPlayed
                        ? dateFormatter.format(new Date(selectedSummary.lastPlayed))
                        : "Nog niet gespeeld"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Puntensaldo</p>
                    <p className="mt-1 text-lg font-medium text-slate-200">
                      {selectedSummary.playerAPointDifferential >= 0 ? "+" : ""}
                      {selectedSummary.playerAPointDifferential}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold text-white">Matchgeschiedenis</h3>
              {!pairMatches.length ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">
                  Deze spelers hebben nog geen potjes tegen elkaar gespeeld.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/5 text-xs uppercase tracking-widest text-axoft-200">
                      <tr>
                        <th className="px-4 py-3 text-left">Datum</th>
                        <th className="px-4 py-3 text-left">Winnaar</th>
                        <th className="px-4 py-3 text-left">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pairMatches.map((match) => {
                        const winnerIsA = match.winnerId === playerAId;
                        const score =
                          match.playerOneId === playerAId
                            ? `${match.playerOnePoints} - ${match.playerTwoPoints}`
                            : `${match.playerTwoPoints} - ${match.playerOnePoints}`;
                        return (
                          <tr key={match.id} className="border-t border-white/5">
                            <td className="px-4 py-3 text-slate-200">
                              {matchDateFormatter.format(new Date(match.playedAt))}
                            </td>
                            <td
                              className={`px-4 py-3 font-semibold ${
                                winnerIsA ? "text-emerald-300" : "text-axoft-200"
                              }`}
                            >
                              {match.winner.name}
                            </td>
                            <td className="px-4 py-3 text-slate-100">{score}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {hottestRivalries.length ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Populaire rivaliteiten</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {hottestRivalries.map((pair) => (
              <button
                key={`${pair.playerAId}-${pair.playerBId}`}
                type="button"
                onClick={() => {
                  setPlayerAId(pair.playerAId);
                  setPlayerBId(pair.playerBId);
                }}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-left transition hover:border-axoft-400/80 hover:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">
                    {pair.playerAName} vs {pair.playerBName}
                  </p>
                  <span className="rounded-full bg-axoft-500/15 px-3 py-1 text-xs font-medium text-axoft-200">
                    {pair.matches} potjes
                  </span>
                </div>
                <p className="mt-2 text-xs uppercase tracking-widest text-slate-400">
                  Leider: {pair.leader}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  Laatste ontmoeting:{" "}
                  {pair.lastPlayed ? dateFormatter.format(new Date(pair.lastPlayed)) : "Onbekend"}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
                    <p className="font-semibold text-emerald-100">{pair.playerAName}</p>
                    <p className="text-emerald-200/80">
                      {pair.playerAWins} win | {pair.playerAPoints} punten
                    </p>
                  </div>
                  <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3">
                    <p className="font-semibold text-rose-100">{pair.playerBName}</p>
                    <p className="text-rose-200/80">
                      {pair.playerBWins} win | {pair.playerBPoints} punten
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
