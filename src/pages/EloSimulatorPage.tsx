import { useEffect, useMemo, useState } from "react";
import { useAppData } from "../context/AppDataContext";
import type { PlayerStats, SeasonSummary } from "../types";

const BASE_RATING = 1000;
const K_FACTOR = 32;

const formatPct = (value: number) => `${Math.round(value * 100)}%`;

export function EloSimulatorPage() {
  const { players, seasons, currentSeasonId } = useAppData();

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.player.name.localeCompare(b.player.name)),
    [players]
  );

  const activeSeason: SeasonSummary | null = useMemo(() => {
    if (!seasons.length) {
      return null;
    }
    if (currentSeasonId != null) {
      return (
        seasons.find((season) => season.id === currentSeasonId) ?? seasons[0]
      );
    }
    return seasons[0];
  }, [currentSeasonId, seasons]);

  const ratingMap = useMemo(() => {
    const map = new Map<number, number>();
    if (activeSeason) {
      activeSeason.standings.forEach((standing) => {
        map.set(standing.player.id, standing.rating);
      });
    }
    return map;
  }, [activeSeason]);

  const getRating = (player: PlayerStats | undefined) => {
    if (!player) {
      return BASE_RATING;
    }
    return ratingMap.get(player.player.id) ?? BASE_RATING;
  };

  const [playerOneId, setPlayerOneId] = useState<number | null>(
    () => sortedPlayers[0]?.player.id ?? null
  );
  const [playerTwoId, setPlayerTwoId] = useState<number | null>(
    () => sortedPlayers[1]?.player.id ?? null
  );

  useEffect(() => {
    if (!playerOneId && sortedPlayers[0]) {
      setPlayerOneId(sortedPlayers[0].player.id);
    }
    if (
      (!playerTwoId || playerTwoId === playerOneId) &&
      sortedPlayers.length > 1
    ) {
      const fallback = sortedPlayers.find(
        (entry) => entry.player.id !== playerOneId
      );
      if (fallback) {
        setPlayerTwoId(fallback.player.id);
      }
    }
  }, [playerOneId, playerTwoId, sortedPlayers]);

  const playerOne = sortedPlayers.find((entry) => entry.player.id === playerOneId);
  const playerTwo = sortedPlayers.find((entry) => entry.player.id === playerTwoId);

  const simulation = useMemo(() => {
    if (!playerOne || !playerTwo || playerOne.player.id === playerTwo.player.id) {
      return null;
    }
    const ratingA = getRating(playerOne);
    const ratingB = getRating(playerTwo);
    const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
    const expectedB = 1 - expectedA;
    const deltaWinA = Math.round(K_FACTOR * (1 - expectedA));
    const deltaLossA = Math.round(K_FACTOR * (0 - expectedA));
    const deltaWinB = Math.round(K_FACTOR * (1 - expectedB));
    const deltaLossB = Math.round(K_FACTOR * (0 - expectedB));

    return {
      ratingA,
      ratingB,
      expectedA,
      expectedB,
      deltaWinA,
      deltaLossA,
      deltaWinB,
      deltaLossB,
      ratingGap: ratingA - ratingB,
    };
  }, [playerOne, playerTwo]);

  const selectionDisabled = sortedPlayers.length < 2;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
          Elo simulator
        </p>
        <h1 className="text-3xl font-semibold text-white">Bereken je risico</h1>
        <p className="text-sm text-slate-300">
          Kies twee spelers en ontdek hoeveel Elo je wint of verliest bij een
          overwinning of nederlaag volgens dezelfde formule als het dashboard.
        </p>
        {activeSeason ? (
          <p className="text-xs text-axoft-200/80">
            Gebaseerd op seizoensstand: {activeSeason.name}
          </p>
        ) : null}
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
          <h2 className="text-lg font-semibold text-white">Selecteer spelers</h2>
          {selectionDisabled ? (
            <p className="mt-4 text-sm text-slate-400">
              Voeg minstens twee spelers toe om de simulator te gebruiken.
            </p>
          ) : (
            <div className="mt-6 grid gap-4">
              <label className="space-y-2 text-sm text-slate-200">
                <span className="text-xs uppercase tracking-widest text-axoft-200/80">
                  Speler A
                </span>
                <select
                  value={playerOneId ?? ""}
                  onChange={(event) => setPlayerOneId(Number(event.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-axoft-400 focus:outline-none"
                >
                  {sortedPlayers.map((entry) => (
                    <option key={entry.player.id} value={entry.player.id}>
                      {entry.player.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">
                  Huidige Elo: {playerOne ? getRating(playerOne) : "–"}
                </p>
              </label>

              <label className="space-y-2 text-sm text-slate-200">
                <span className="text-xs uppercase tracking-widest text-axoft-200/80">
                  Speler B
                </span>
                <select
                  value={playerTwoId ?? ""}
                  onChange={(event) => setPlayerTwoId(Number(event.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-axoft-400 focus:outline-none"
                >
                  {sortedPlayers.map((entry) => (
                    <option key={entry.player.id} value={entry.player.id}>
                      {entry.player.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">
                  Huidige Elo: {playerTwo ? getRating(playerTwo) : "–"}
                </p>
              </label>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-axoft-500/20 bg-slate-950/60 p-6">
          <h2 className="text-lg font-semibold text-white">Resultaat</h2>
          {!simulation ? (
            <p className="mt-4 text-sm text-slate-400">
              Kies twee verschillende spelers om de berekening te zien.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <span>{playerOne?.player.name}</span>
                  <span className="text-xs uppercase tracking-[0.3em] text-axoft-200/70">
                    {simulation.ratingA} Elo
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
                  <span>Win kans: {formatPct(simulation.expectedA)}</span>
                  <span>Rating verschil: {simulation.ratingGap}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-100">
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
                      Bij winst
                    </p>
                    <p className="mt-1 text-lg font-semibold text-emerald-200">
                      {simulation.deltaWinA >= 0 ? "+" : ""}
                      {simulation.deltaWinA} Elo
                    </p>
                  </div>
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-100">
                    <p className="text-xs uppercase tracking-[0.3em] text-rose-200/70">
                      Bij verlies
                    </p>
                    <p className="mt-1 text-lg font-semibold text-rose-200">
                      {simulation.deltaLossA} Elo
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <span>{playerTwo?.player.name}</span>
                  <span className="text-xs uppercase tracking-[0.3em] text-axoft-200/70">
                    {simulation.ratingB} Elo
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
                  <span>Win kans: {formatPct(simulation.expectedB)}</span>
                  <span>Rating verschil: {-simulation.ratingGap}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-100">
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
                      Bij winst
                    </p>
                    <p className="mt-1 text-lg font-semibold text-emerald-200">
                      {simulation.deltaWinB >= 0 ? "+" : ""}
                      {simulation.deltaWinB} Elo
                    </p>
                  </div>
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-100">
                    <p className="text-xs uppercase tracking-[0.3em] text-rose-200/70">
                      Bij verlies
                    </p>
                    <p className="mt-1 text-lg font-semibold text-rose-200">
                      {simulation.deltaLossB} Elo
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-sm text-slate-300">
        <h2 className="text-base font-semibold text-white">Hoe werkt dit?</h2>
        <p className="mt-3">
          We gebruiken dezelfde Elo-formule als de seizoensranglijst met een basisrating
          van {BASE_RATING} en K-factor {K_FACTOR}. Je verwachte score bepaalt hoeveel
          punten je kunt winnen of verliezen: versla een hogere Elo en je stijgt sneller,
          maar verlies van iemand met een lagere Elo en je levert meer in.
          {activeSeason
            ? ` Deze simulatie gebruikt de ratings uit ${activeSeason.name}.`
            : ""}
        </p>
      </section>
    </div>
  );
}
