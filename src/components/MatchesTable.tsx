import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Match } from "../types";
import { EloIcon } from "./EloIcon";
import { buildMatchInsights, getRivalryPath } from "../lib/matchInsights";

type MatchesTableProps = {
  matches: Match[];
  contextMatches?: Match[];
  onEdit?: (match: Match) => void;
  onDelete?: (match: Match) => void;
  pendingDeleteId?: number | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function MatchesTable({
  matches,
  contextMatches,
  onEdit,
  onDelete,
  pendingDeleteId,
}: MatchesTableProps) {
  const [flippedMatchIds, setFlippedMatchIds] = useState<Set<number>>(
    () => new Set()
  );
  const previousScoresRef = useRef<Map<number, string>>(new Map());
  const insightsByMatchId = useMemo(
    () => buildMatchInsights(contextMatches ?? matches),
    [contextMatches, matches]
  );

  useEffect(() => {
    const previousScores = previousScoresRef.current;
    const nextScores = new Map<number, string>();
    const changedIds: number[] = [];

    matches.forEach((match) => {
      const scoreKey = `${match.playerOnePoints}-${match.playerTwoPoints}`;
      nextScores.set(match.id, scoreKey);

      const previous = previousScores.get(match.id);
      if (previous !== undefined && previous !== scoreKey) {
        changedIds.push(match.id);
      }

      if (previousScores.size > 0 && previous === undefined) {
        changedIds.push(match.id);
      }
    });

    previousScoresRef.current = nextScores;

    if (!changedIds.length) {
      return;
    }

    setFlippedMatchIds(new Set(changedIds));
    const timeoutId = window.setTimeout(() => {
      setFlippedMatchIds(new Set());
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [matches]);

  const badgeClassByTone = {
    axoft:
      "border-axoft-400/40 bg-axoft-500/10 text-axoft-100",
    emerald:
      "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    amber:
      "border-amber-400/40 bg-amber-500/10 text-amber-100",
    rose:
      "border-rose-400/40 bg-rose-500/10 text-rose-100",
  } as const;

  const renderHighlights = (match: Match) => {
    const insight = insightsByMatchId.get(match.id);
    const rivalryPath = getRivalryPath(match.playerOneId, match.playerTwoId);

    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {insight?.badges.map((badge) => (
          <span
            key={`${match.id}-${badge.id}`}
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${badgeClassByTone[badge.tone]}`}
          >
            {badge.label}
          </span>
        ))}
        <Link
          to={rivalryPath}
          className="inline-flex items-center rounded-full border border-white/15 bg-slate-900/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-200 transition hover:border-axoft-400/60 hover:text-white"
        >
          Rivalry
        </Link>
      </div>
    );
  };

  if (!matches.length) {
    return (
      <div className="glass-card rounded-xl p-6 text-center text-slate-400">
        Nog geen resultaten ingevoerd.
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl border border-white/10 p-2 sm:p-4">
      <div className="md:hidden space-y-3">
        {matches.map((match) => {
          const isDeleting = pendingDeleteId === match.id;
          return (
            <article
              key={match.id}
              className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200"
            >
              <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-axoft-200">
                    {dateTimeFormatter.format(new Date(match.playedAt))}
                  </p>
                  <p className="text-base font-semibold text-white">
                    {match.playerOne.name} vs {match.playerTwo.name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Seizoen: {match.season?.name ?? "Onbekend"}
                  </p>
                </div>
                <span className="inline-flex items-center justify-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Winnaar: {match.winner.name}
                </span>
              </header>

              <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2">
                <span className="text-xs uppercase tracking-widest text-slate-400">
                  Score
                </span>
                <span
                  className={`text-lg font-semibold text-white ${
                    flippedMatchIds.has(match.id) ? "score-flip" : ""
                  }`}
                >
                  {match.playerOnePoints} - {match.playerTwoPoints}
                </span>
              </div>
              {renderHighlights(match)}

              {/* Elo changes (mobile) */}
              <div className="mt-2 flex items-center gap-4">
                <div className="text-xs text-slate-400">
                  <div className="flex items-center gap-2 uppercase tracking-widest">
                    <EloIcon
                      className="h-3.5 w-3.5 text-axoft-200"
                      ariaHidden
                    />
                    <span>Elo {match.playerOne.name}</span>
                  </div>
                  <div>
                    {match.playerOneEloDelta != null ? (
                      <span
                        className={`font-semibold ${
                          match.playerOneEloDelta >= 0
                            ? "text-emerald-300"
                            : "text-rose-300"
                        }`}
                      >
                        {match.playerOneEloDelta >= 0 ? "+" : ""}
                        {match.playerOneEloDelta}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  <div className="flex items-center gap-2 uppercase tracking-widest">
                    <EloIcon
                      className="h-3.5 w-3.5 text-axoft-200"
                      ariaHidden
                    />
                    <span>Elo {match.playerTwo.name}</span>
                  </div>
                  <div>
                    {match.playerTwoEloDelta != null ? (
                      <span
                        className={`font-semibold ${
                          match.playerTwoEloDelta >= 0
                            ? "text-emerald-300"
                            : "text-rose-300"
                        }`}
                      >
                        {match.playerTwoEloDelta >= 0 ? "+" : ""}
                        {match.playerTwoEloDelta}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </div>
                </div>
              </div>

              {(onEdit || onDelete) && (
                <div className="mt-3 flex gap-2">
                  {onEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(match)}
                      className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/30"
                    >
                      Bewerken
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(match)}
                      disabled={isDeleting}
                      className="flex-1 rounded-lg border border-rose-400/40 px-3 py-2 text-xs font-medium text-rose-200 transition hover:border-rose-400 hover:text-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400/40 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isDeleting ? "Verwijderen..." : "Verwijderen"}
                    </button>
                  ) : null}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-widest text-axoft-200">
            <tr>
              <th className="px-4 py-3 text-left">Datum</th>
              <th className="px-4 py-3 text-left">Speler A</th>
              <th className="px-4 py-3 text-left">Speler B</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Highlights</th>
              <th className="px-4 py-3 text-left">Winnaar</th>
              <th className="px-4 py-3 text-left">Seizoen</th>
              <th className="px-4 py-3 text-left">
                <span className="inline-flex items-center gap-2">
                  <EloIcon
                    className="h-4 w-4 text-axoft-200"
                    title="Elo-wijziging"
                  />
                  Elo-wijziging
                </span>
              </th>
              {(onEdit || onDelete) && (
                <th className="px-4 py-3 text-left">Acties</th>
              )}
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => {
              const isDeleting = pendingDeleteId === match.id;
              return (
                <tr key={match.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-slate-200">
                    {dateTimeFormatter.format(new Date(match.playedAt))}
                  </td>
                  <td className="px-4 py-3 text-white">
                    {match.playerOne.name}
                  </td>
                  <td className="px-4 py-3 text-white">
                    {match.playerTwo.name}
                  </td>
                  <td className="px-4 py-3 text-slate-100">
                    <span className={flippedMatchIds.has(match.id) ? "score-flip" : ""}>
                      {match.playerOnePoints} - {match.playerTwoPoints}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(insightsByMatchId.get(match.id)?.badges ?? []).map(
                        (badge) => (
                          <span
                            key={`${match.id}-${badge.id}`}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${badgeClassByTone[badge.tone]}`}
                          >
                            {badge.label}
                          </span>
                        )
                      )}
                      <Link
                        to={getRivalryPath(match.playerOneId, match.playerTwoId)}
                        className="inline-flex items-center rounded-full border border-white/15 bg-slate-900/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-200 transition hover:border-axoft-400/60 hover:text-white"
                      >
                        Rivalry
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-300">
                    {match.winner.name}
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {match.season?.name ?? "Onbekend"}
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {typeof match.playerOneEloDelta === "number" ||
                    typeof match.playerTwoEloDelta === "number" ? (
                      <div className="text-sm">
                        <span
                          className={`mr-2 ${
                            match.playerOneEloDelta &&
                            match.playerOneEloDelta >= 0
                              ? "text-emerald-300"
                              : "text-rose-300"
                          }`}
                        >
                          {match.playerOneEloDelta != null
                            ? (match.playerOneEloDelta >= 0 ? "+" : "") +
                              match.playerOneEloDelta
                            : "-"}
                        </span>
                        <span
                          className={`${
                            match.playerTwoEloDelta &&
                            match.playerTwoEloDelta >= 0
                              ? "text-emerald-300"
                              : "text-rose-300"
                          }`}
                        >
                          {match.playerTwoEloDelta != null
                            ? (match.playerTwoEloDelta >= 0 ? "+" : "") +
                              match.playerTwoEloDelta
                            : "-"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  {(onEdit || onDelete) && (
                    <td className="px-4 py-3 text-slate-200">
                      <div className="flex gap-2">
                        {onEdit ? (
                          <button
                            type="button"
                            onClick={() => onEdit(match)}
                            className="rounded-md border border-white/10 px-2 py-1 text-xs font-medium text-slate-100 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
                          >
                            Bewerken
                          </button>
                        ) : null}
                        {onDelete ? (
                          <button
                            type="button"
                            onClick={() => onDelete(match)}
                            disabled={isDeleting}
                            className="rounded-md border border-rose-400/40 px-2 py-1 text-xs font-medium text-rose-200 transition hover:border-rose-400 hover:text-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400/40 disabled:cursor-not-allowed"
                          >
                            {isDeleting ? "Verwijderen..." : "Verwijderen"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
