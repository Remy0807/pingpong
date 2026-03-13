import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { buildMatchInsights, getRivalryPath } from "../lib/matchInsights";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function RivalryPage() {
  const navigate = useNavigate();
  const params = useParams<{ playerAId: string; playerBId: string }>();
  const playerAId = Number(params.playerAId);
  const playerBId = Number(params.playerBId);
  const { players, matches } = useAppData();

  const playerA = players.find((entry) => entry.player.id === playerAId)?.player;
  const playerB = players.find((entry) => entry.player.id === playerBId)?.player;

  const pairMatches = useMemo(() => {
    if (!Number.isInteger(playerAId) || !Number.isInteger(playerBId)) {
      return [];
    }

    return matches
      .filter(
        (match) =>
          (match.playerOneId === playerAId && match.playerTwoId === playerBId) ||
          (match.playerOneId === playerBId && match.playerTwoId === playerAId)
      )
      .sort(
        (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
      );
  }, [matches, playerAId, playerBId]);

  const insightsByMatch = useMemo(() => buildMatchInsights(matches), [matches]);

  const stats = useMemo(() => {
    if (!pairMatches.length) {
      return {
        matches: 0,
        playerAWins: 0,
        playerBWins: 0,
        playerAPoints: 0,
        playerBPoints: 0,
        avgTotalPoints: "0.0",
        closeGames: 0,
        blowouts: 0,
        upsets: 0,
      };
    }

    let playerAWins = 0;
    let playerBWins = 0;
    let playerAPoints = 0;
    let playerBPoints = 0;
    let totalPoints = 0;
    let closeGames = 0;
    let blowouts = 0;
    let upsets = 0;

    pairMatches.forEach((match) => {
      const aPoints =
        match.playerOneId === playerAId
          ? match.playerOnePoints
          : match.playerTwoPoints;
      const bPoints =
        match.playerOneId === playerBId
          ? match.playerOnePoints
          : match.playerTwoPoints;

      playerAPoints += aPoints;
      playerBPoints += bPoints;
      totalPoints += aPoints + bPoints;

      if (match.winnerId === playerAId) {
        playerAWins += 1;
      } else if (match.winnerId === playerBId) {
        playerBWins += 1;
      }

      const insight = insightsByMatch.get(match.id);
      if (insight?.isCloseGame) {
        closeGames += 1;
      }
      if (insight?.isBlowout) {
        blowouts += 1;
      }
      if (insight?.isUpset) {
        upsets += 1;
      }
    });

    return {
      matches: pairMatches.length,
      playerAWins,
      playerBWins,
      playerAPoints,
      playerBPoints,
      avgTotalPoints: (totalPoints / pairMatches.length).toFixed(1),
      closeGames,
      blowouts,
      upsets,
    };
  }, [insightsByMatch, pairMatches, playerAId, playerBId]);

  const recentMatches = pairMatches.slice(0, 5);
  const momentumA = recentMatches.filter((match) => match.winnerId === playerAId).length;
  const momentumB = recentMatches.filter((match) => match.winnerId === playerBId).length;

  if (!playerA || !playerB) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-axoft-200 hover:text-white"
        >
          ← Terug
        </button>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
          Rivaliteit niet gevonden. Controleer of beide spelers nog bestaan.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-axoft-200 transition hover:text-white"
        >
          ← Terug
        </button>
        <Link
          to="/head-to-head"
          className="inline-flex items-center rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200 transition hover:border-axoft-400/60 hover:text-white"
        >
          Head to head
        </Link>
      </div>

      <header className="glass-card rounded-2xl border border-white/10 bg-slate-950/50 p-6">
        <p className="text-xs uppercase tracking-[0.4em] text-axoft-200/80">
          Rivalry profile
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">
          {playerA.name} vs {playerB.name}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Complete mini-profiel van dit duo: historie, momentum en gemiddelde score.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/80">Historiek</p>
          <p className="mt-1 text-2xl font-semibold text-white">{stats.matches}</p>
          <p className="text-xs text-slate-400">Totale duels</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/80">Momentum</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {momentumA}-{momentumB}
          </p>
          <p className="text-xs text-slate-400">Laatste 5 wedstrijden</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/80">Gem. score</p>
          <p className="mt-1 text-2xl font-semibold text-white">{stats.avgTotalPoints}</p>
          <p className="text-xs text-slate-400">Totaal punten per duel</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/80">Highlights</p>
          <p className="mt-1 text-base font-semibold text-white">
            {stats.closeGames} close • {stats.blowouts} blowout • {stats.upsets} upset
          </p>
          <p className="text-xs text-slate-400">Binnen deze rivaliteit</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">{playerA.name}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{stats.playerAWins}</p>
          <p className="text-sm text-slate-300">Wins</p>
          <p className="mt-2 text-xs text-slate-400">{stats.playerAPoints} punten totaal</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/80">{playerB.name}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{stats.playerBWins}</p>
          <p className="text-sm text-slate-300">Wins</p>
          <p className="mt-2 text-xs text-slate-400">{stats.playerBPoints} punten totaal</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Laatste 5 duels</h3>
        {!recentMatches.length ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm text-slate-400">
            Deze spelers hebben nog geen wedstrijden tegen elkaar gespeeld.
          </div>
        ) : (
          <div className="space-y-3">
            {recentMatches.map((match) => {
              const insight = insightsByMatch.get(match.id);
              const rivalryPath = getRivalryPath(match.playerOneId, match.playerTwoId);

              return (
                <article
                  key={match.id}
                  className="rounded-xl border border-white/10 bg-slate-950/45 p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                        {formatDateTime(match.playedAt)}
                      </p>
                      <p className="mt-1 text-base font-semibold text-white">
                        {match.playerOne.name} {match.playerOnePoints} - {match.playerTwoPoints}{" "}
                        {match.playerTwo.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        Winnaar: {match.winner.name} • Seizoen:{" "}
                        {match.season?.name ?? "Onbekend"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {insight?.badges.map((badge) => (
                        <span
                          key={`${match.id}-${badge.id}`}
                          className="rounded-full border border-white/15 bg-slate-900/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-200"
                        >
                          {badge.label}
                        </span>
                      ))}
                      <Link
                        to={rivalryPath}
                        className="rounded-full border border-axoft-400/40 bg-axoft-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-axoft-200"
                      >
                        Rivalry
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {pairMatches.length > 5 ? (
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Oudere duels beschikbaar sinds {formatDate(pairMatches[pairMatches.length - 1].playedAt)}.
        </p>
      ) : null}
    </div>
  );
}
