type DoublesLeaderboardRow = {
  id: string | number;
  label: string;
  subLabel?: string;
  rating?: number;
  wins: number;
  losses: number;
  matches: number;
  pointsFor: number;
  pointsAgainst: number;
  winRate: number;
  pointDifferential: number;
};

type DoublesLeaderboardTableProps = {
  title: string;
  description: string;
  rows: DoublesLeaderboardRow[];
  emptyMessage: string;
};

const percentageFormatter = new Intl.NumberFormat("nl-NL", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function DoublesLeaderboardTable({
  title,
  description,
  rows,
  emptyMessage,
}: DoublesLeaderboardTableProps) {
  const showRating = rows.some((row) => typeof row.rating === "number");

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:p-5">
      <header>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </header>

      {!rows.length ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
          {emptyMessage}
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3 md:hidden">
            {rows.map((row, index) => (
              <article
                key={row.id}
                className="rounded-xl border border-white/10 bg-slate-950/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/70">
                      #{index + 1}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-white">
                      {row.label}
                    </h3>
                    {row.subLabel ? (
                      <p className="mt-1 text-xs text-slate-400">{row.subLabel}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {typeof row.rating === "number" ? (
                      <span className="rounded-full bg-axoft-500/15 px-3 py-1 text-xs font-semibold text-axoft-200">
                        Elo {row.rating}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                      {percentageFormatter.format(row.winRate)}
                    </span>
                  </div>
                </div>
                <dl
                  className={`mt-4 grid gap-3 text-xs text-slate-300 ${
                    showRating ? "grid-cols-4" : "grid-cols-3"
                  }`}
                >
                  {showRating ? (
                    <div>
                      <dt className="uppercase tracking-widest text-slate-500">
                        Elo
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-white">
                        {typeof row.rating === "number" ? row.rating : "-"}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="uppercase tracking-widest text-slate-500">
                      Record
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-white">
                      {row.wins}-{row.losses}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-widest text-slate-500">
                      Potjes
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-white">
                      {row.matches}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-widest text-slate-500">
                      Saldo
                    </dt>
                    <dd
                      className={`mt-1 text-sm font-semibold ${
                        row.pointDifferential >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }`}
                    >
                      {row.pointDifferential >= 0 ? "+" : ""}
                      {row.pointDifferential}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-widest text-axoft-200">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Naam</th>
                  {showRating ? (
                    <th className="px-4 py-3 text-left">Doubles Elo</th>
                  ) : null}
                  <th className="px-4 py-3 text-left">Potjes</th>
                  <th className="px-4 py-3 text-left">W</th>
                  <th className="px-4 py-3 text-left">L</th>
                  <th className="px-4 py-3 text-left">Win%</th>
                  <th className="px-4 py-3 text-left">Punten (+)</th>
                  <th className="px-4 py-3 text-left">Punten (-)</th>
                  <th className="px-4 py-3 text-left">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{row.label}</p>
                      {row.subLabel ? (
                        <p className="text-xs text-slate-400">{row.subLabel}</p>
                      ) : null}
                    </td>
                    {showRating ? (
                      <td className="px-4 py-3 text-slate-200">
                        {typeof row.rating === "number" ? row.rating : "-"}
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-slate-200">{row.matches}</td>
                    <td className="px-4 py-3 text-emerald-300">{row.wins}</td>
                    <td className="px-4 py-3 text-rose-300">{row.losses}</td>
                    <td className="px-4 py-3 text-slate-200">
                      {percentageFormatter.format(row.winRate)}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{row.pointsFor}</td>
                    <td className="px-4 py-3 text-slate-200">{row.pointsAgainst}</td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        row.pointDifferential >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }`}
                    >
                      {row.pointDifferential >= 0 ? "+" : ""}
                      {row.pointDifferential}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
