import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MatchesTable } from "../components/MatchesTable";
import { BadgeLegend } from "../components/BadgeLegend";
import { EloIcon } from "../components/EloIcon";
import { useAppData } from "../context/AppDataContext";
import type { Match } from "../types";
import type { PlayerBadge } from "../../shared/badges";

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

type OpponentRecord = {
  opponentId: number;
  opponentName: string;
  matches: number;
  wins: number;
  losses: number;
  lastPlayedAt: string;
};

const badgeDateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function BadgeShowcase({ badges }: { badges: PlayerBadge[] }) {
  if (!badges.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-6 text-sm text-slate-400">
        Nog geen badges verzameld. Speel meer wedstrijden om achievements te ontgrendelen.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {badges.map((badge) => (
        <article
          key={badge.id}
          className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-axoft-200/80">
                {badge.category}
              </p>
              <h3 className="mt-1 text-base font-semibold text-white">{badge.label}</h3>
            </div>
            <EloIcon className="h-5 w-5 text-axoft-200/70" ariaHidden />
          </div>
          <p className="mt-2 text-xs text-slate-400">{badge.description}</p>
          {badge.earnedAt ? (
            <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-axoft-200/60">
              Sinds {badgeDateFormatter.format(new Date(badge.earnedAt))}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function OpponentOverview({ records }: { records: OpponentRecord[] }) {
  if (!records.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-6 text-sm text-slate-400">
        Nog geen onderlinge resultaten beschikbaar.
      </div>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {records.map((record) => {
        const winRate = record.matches
          ? Math.round((record.wins / record.matches) * 100)
          : 0;
        return (
          <li
            key={record.opponentId}
            className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200"
          >
            <header className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-white">{record.opponentName}</h3>
              <span className="rounded-full bg-axoft-500/15 px-3 py-1 text-xs font-semibold text-axoft-200">
                {winRate}% winrate
              </span>
            </header>
            <p className="mt-2 text-xs text-slate-400">
              Matches: {record.matches} • {record.wins} gewonnen • {record.losses} verloren
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-axoft-200/60">
              Laatste duel: {formatDate(record.lastPlayedAt)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const playerId = Number(id);
  const navigate = useNavigate();
  const { players, matches } = useAppData();
  const entry = players.find((player) => player.player.id === playerId);

  const playerMatches = useMemo<Match[]>(() => {
    return matches
      .filter(
        (match) => match.playerOneId === playerId || match.playerTwoId === playerId
      )
      .sort(
        (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
      );
  }, [matches, playerId]);

  const opponents = useMemo<OpponentRecord[]>(() => {
    const map = new Map<number, OpponentRecord>();
    playerMatches.forEach((match) => {
      const isPlayerOne = match.playerOneId === playerId;
      const opponent = isPlayerOne ? match.playerTwo : match.playerOne;
      const didWin = match.winnerId === playerId;
      const existing = map.get(opponent.id);
      const record: OpponentRecord = existing ?? {
        opponentId: opponent.id,
        opponentName: opponent.name,
        matches: 0,
        wins: 0,
        losses: 0,
        lastPlayedAt: match.playedAt,
      };
      record.matches += 1;
      if (didWin) {
        record.wins += 1;
      } else {
        record.losses += 1;
      }
      if (
        new Date(match.playedAt).getTime() >
        new Date(record.lastPlayedAt).getTime()
      ) {
        record.lastPlayedAt = match.playedAt;
      }
      map.set(opponent.id, record);
    });

    return Array.from(map.values()).sort((a, b) => b.matches - a.matches);
  }, [playerMatches, playerId]);

  if (!entry) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-axoft-200 hover:text-white"
        >
          ← Terug
        </button>
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-6 text-sm text-rose-100">
          Deze speler bestaat niet meer. Keer terug naar het spelersoverzicht.
        </div>
        <Link
          to="/players"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-axoft-200 transition hover:border-axoft-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-axoft-400/40"
        >
          Naar spelersoverzicht
        </Link>
      </div>
    );
  }

  const seasonHighlight = playerMatches[0];

  return (
    <div className="space-y-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-axoft-200 transition hover:text-white"
      >
        ← Terug naar overzicht
      </button>

      <header className="glass-card flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200/80">Profiel</p>
          <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
            {entry.player.name}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {entry.wins} gewonnen • {entry.losses} verloren • Winrate{" "}
            {entry.matches ? Math.round(entry.winRate * 100) : 0}% • Huidige streak:{" "}
            {entry.currentStreak}
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-widest text-axoft-200/80">Totaal</p>
          <p className="mt-2 text-3xl font-semibold text-white">{entry.matches}</p>
          <p className="text-xs text-slate-400">Gespeelde wedstrijden</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-widest text-axoft-200/80">Saldo</p>
          <p
            className={`mt-2 text-3xl font-semibold ${
              entry.pointDifferential >= 0 ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {entry.pointDifferential >= 0 ? "+" : ""}
            {entry.pointDifferential}
          </p>
          <p className="text-xs text-slate-400">Punten voor - tegen</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-widest text-axoft-200/80">
            Titels & streaks
          </p>
          <p className="mt-2 text-xl font-semibold text-white">
            {entry.championships} titels • Langste streak {entry.longestStreak}
          </p>
          <p className="text-xs text-slate-400">Historische prestaties</p>
        </div>
      </section>

      <section className="space-y-3">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Badges & achievements</h2>
            <p className="text-sm text-slate-400">
              Overzicht van behaalde prestaties door {entry.player.name}.
            </p>
          </div>
          <Link
            to="#badge-legend"
            className="text-xs uppercase tracking-[0.3em] text-axoft-200 hover:text-white"
          >
            → Badge uitleg
          </Link>
        </header>
        <BadgeShowcase badges={entry.badges} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Populairste tegenstanders</h2>
        <OpponentOverview records={opponents.slice(0, 4)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Recentste wedstrijden</h2>
        {playerMatches.length ? (
          <MatchesTable
            matches={playerMatches.slice(0, 8)}
            contextMatches={matches}
          />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">
            Deze speler heeft nog geen wedstrijden gespeeld.
          </div>
        )}
      </section>

      {seasonHighlight ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Laatste highlight</h2>
          <div className="rounded-2xl border border-axoft-500/20 bg-slate-950/40 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-widest text-axoft-200/80">
              {formatDateTime(seasonHighlight.playedAt)}
            </p>
            <p className="mt-2 text-base font-semibold text-white">
              {seasonHighlight.playerOne.name} {seasonHighlight.playerOnePoints} -{" "}
              {seasonHighlight.playerTwoPoints} {seasonHighlight.playerTwo.name}
            </p>
            <p className="text-xs text-slate-400">
              Winnaar: {seasonHighlight.winner.name} • Seizoen:{" "}
              {seasonHighlight.season?.name ?? "Onbekend"}
            </p>
          </div>
        </section>
      ) : null}

      <section id="badge-legend">
        <BadgeLegend />
      </section>
    </div>
  );
}
