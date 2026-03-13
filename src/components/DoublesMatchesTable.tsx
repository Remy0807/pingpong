import type { DoublesMatch } from "../types";
import type { DoublesMatchEloBreakdown } from "../lib/doubles";
import { getDoublesTeamLabel } from "../lib/doubles";

type DoublesMatchesTableProps = {
  matches: DoublesMatch[];
  matchBreakdowns?: Map<number, DoublesMatchEloBreakdown>;
  onEdit?: (match: DoublesMatch) => void;
  onDelete?: (match: DoublesMatch) => void;
  pendingDeleteId?: number | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function DoublesMatchesTable({
  matches,
  matchBreakdowns,
  onEdit,
  onDelete,
  pendingDeleteId,
}: DoublesMatchesTableProps) {
  if (!matches.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-6 text-center text-sm text-slate-400">
        Nog geen 2v2-resultaten ingevoerd.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-2 sm:p-4">
      <div className="space-y-3 md:hidden">
        {matches.map((match) => {
          const isDeleting = pendingDeleteId === match.id;
          const teamOneLabel = getDoublesTeamLabel(match.teamOnePlayers);
          const teamTwoLabel = getDoublesTeamLabel(match.teamTwoPlayers);
          const winnerLabel = match.winnerTeam === 1 ? teamOneLabel : teamTwoLabel;
          const elo = matchBreakdowns?.get(match.id);

          return (
            <article
              key={match.id}
              className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200"
            >
              <header className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-axoft-200">
                    {dateTimeFormatter.format(new Date(match.playedAt))}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-white">
                    {teamOneLabel}
                  </h3>
                  <p className="text-xs text-slate-400">vs {teamTwoLabel}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Seizoen: {match.season?.name ?? "Onbekend"}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Winnaar: {winnerLabel}
                </span>
              </header>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2">
                <span className="text-xs uppercase tracking-widest text-slate-400">
                  Score
                </span>
                <span className="text-lg font-semibold text-white">
                  {match.teamOnePoints} - {match.teamTwoPoints}
                </span>
              </div>

              {elo ? (
                <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
                  <p>
                    Elo vooraf: {teamOneLabel} {elo.teamOneRatingBefore} vs{" "}
                    {teamTwoLabel} {elo.teamTwoRatingBefore}
                  </p>
                  <p className="mt-1">
                    Delta per speler: Team A{" "}
                    <span
                      className={
                        elo.teamOneDelta >= 0
                          ? "font-semibold text-emerald-300"
                          : "font-semibold text-rose-300"
                      }
                    >
                      {elo.teamOneDelta >= 0 ? "+" : ""}
                      {elo.teamOneDelta}
                    </span>{" "}
                    • Team B{" "}
                    <span
                      className={
                        elo.teamTwoDelta >= 0
                          ? "font-semibold text-emerald-300"
                          : "font-semibold text-rose-300"
                      }
                    >
                      {elo.teamTwoDelta >= 0 ? "+" : ""}
                      {elo.teamTwoDelta}
                    </span>
                  </p>
                </div>
              ) : null}

              {(onEdit || onDelete) ? (
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
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-widest text-axoft-200">
            <tr>
              <th className="px-4 py-3 text-left">Datum</th>
              <th className="px-4 py-3 text-left">Team A</th>
              <th className="px-4 py-3 text-left">Team B</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Winnaar</th>
              <th className="px-4 py-3 text-left">Seizoen</th>
              {(onEdit || onDelete) ? (
                <th className="px-4 py-3 text-left">Acties</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
                {matches.map((match) => {
                  const isDeleting = pendingDeleteId === match.id;
                  const teamOneLabel = getDoublesTeamLabel(match.teamOnePlayers);
                  const teamTwoLabel = getDoublesTeamLabel(match.teamTwoPlayers);
                  const elo = matchBreakdowns?.get(match.id);

                  return (
                    <tr key={match.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-slate-200">
                    {dateTimeFormatter.format(new Date(match.playedAt))}
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">
                    {teamOneLabel}
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">
                    {teamTwoLabel}
                  </td>
                      <td className="px-4 py-3 text-slate-200">
                        {match.teamOnePoints} - {match.teamTwoPoints}
                      </td>
                      <td className="px-4 py-3 text-emerald-300">
                        {match.winnerTeam === 1 ? teamOneLabel : teamTwoLabel}
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        <div>
                          <p>{match.season?.name ?? "Onbekend"}</p>
                          {elo ? (
                            <p className="mt-1 text-xs text-slate-400">
                              Elo {elo.teamOneRatingBefore}-{elo.teamTwoRatingBefore} • Δ{" "}
                              {elo.teamOneDelta >= 0 ? "+" : ""}
                              {elo.teamOneDelta} / {elo.teamTwoDelta >= 0 ? "+" : ""}
                              {elo.teamTwoDelta}
                            </p>
                          ) : null}
                        </div>
                      </td>
                  {(onEdit || onDelete) ? (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {onEdit ? (
                          <button
                            type="button"
                            onClick={() => onEdit(match)}
                            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/30"
                          >
                            Bewerken
                          </button>
                        ) : null}
                        {onDelete ? (
                          <button
                            type="button"
                            onClick={() => onDelete(match)}
                            disabled={isDeleting}
                            className="rounded-lg border border-rose-400/40 px-3 py-2 text-xs font-medium text-rose-200 transition hover:border-rose-400 hover:text-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400/40 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {isDeleting ? "Verwijderen..." : "Verwijderen"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
