import type { PlayerStats } from "../types";

type LeaderboardProps = {
  players: PlayerStats[];
};

const numberFormatter = new Intl.NumberFormat("nl-NL", {
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("nl-NL", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function Leaderboard({ players }: LeaderboardProps) {
  if (!players.length) {
    return (
      <div className="glass-card rounded-xl p-6 text-center text-slate-400">
        Nog geen statistieken beschikbaar. Voeg resultaten toe om het klassement
        te vullen.
      </div>
    );
  }

  const sorted = [...players].sort((a, b) => {
    // If both players have a season Elo rating, sort by rating first
    if (typeof b.rating === "number" && typeof a.rating === "number") {
      if (b.rating === a.rating) {
        if (b.pointDifferential === a.pointDifferential) {
          return b.matches - a.matches;
        }
        return b.pointDifferential - a.pointDifferential;
      }
      return b.rating - a.rating;
    }
    // Fallback to previous behaviour (winRate)
    if (b.winRate === a.winRate) {
      return b.pointDifferential - a.pointDifferential;
    }
    return b.winRate - a.winRate;
  });

  const topThree = sorted.slice(0, 3);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {topThree.map((entry, index) => (
          <article
            key={entry.player.id}
            className="glass-card rounded-2xl p-6 shadow-card transition hover:-translate-y-1"
          >
            <header className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-axoft-300">
                #{index + 1}
              </span>
              <span className="rounded-full bg-axoft-500/15 px-3 py-1 text-xs font-medium text-axoft-200">
                {percentageFormatter.format(entry.winRate)}
              </span>
            </header>
            <h3 className="mt-4 text-xl font-semibold text-white">
              {entry.player.name}
            </h3>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm text-slate-300">
              <div>
                <dt className="text-xs uppercase tracking-widest text-axoft-200/70">
                  Potjes
                </dt>
                <dd className="text-lg font-semibold text-white">
                  {numberFormatter.format(entry.matches)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-axoft-200/70">
                  Saldo
                </dt>
                <dd className="text-lg font-semibold text-white">
                  {entry.pointDifferential >= 0 ? "+" : ""}
                  {numberFormatter.format(entry.pointDifferential)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
        {sorted.length < 3 ? (
          <div className="glass-card rounded-2xl p-6 text-sm text-slate-400">
            Nog meer spelers nodig om de top 3 te tonen.
          </div>
        ) : null}
      </div>

      <div className="glass-card rounded-2xl border border-white/10 p-2 sm:p-4">
        <div className="md:hidden space-y-3">
          {sorted.map((entry) => (
            <article
              key={entry.player.id}
              className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200"
            >
              <header className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">
                  {entry.player.name}
                </h3>
                <span className="rounded-full bg-axoft-500/15 px-3 py-1 text-xs font-medium text-axoft-200">
                  {percentageFormatter.format(entry.winRate)}
                </span>
              </header>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div>
                  <dt className="uppercase tracking-widest text-slate-500">
                    Potjes
                  </dt>
                  <dd className="text-sm font-semibold text-white">
                    {entry.matches}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase tracking-widest text-slate-500">
                    Saldo
                  </dt>
                  <dd
                    className={`text-sm font-semibold ${
                      entry.pointDifferential >= 0
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    {entry.pointDifferential >= 0 ? "+" : ""}
                    {entry.pointDifferential}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase tracking-widest text-slate-500">
                    Gewonnen
                  </dt>
                  <dd className="text-sm font-semibold text-emerald-300">
                    {entry.wins}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase tracking-widest text-slate-500">
                    Verloren
                  </dt>
                  <dd className="text-sm font-semibold text-rose-300">
                    {entry.losses}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase tracking-widest text-slate-500">
                    Punten +
                  </dt>
                  <dd className="text-sm font-semibold text-slate-100">
                    {entry.pointsFor}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase tracking-widest text-slate-500">
                    Punten -
                  </dt>
                  <dd className="text-sm font-semibold text-slate-100">
                    {entry.pointsAgainst}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-widest text-axoft-200">
              <tr>
                <th className="px-4 py-3 text-left">Speler</th>
                <th className="px-4 py-3 text-left">Elo</th>
                <th className="px-4 py-3 text-left">Potjes</th>
                <th className="px-4 py-3 text-left">Winsten</th>
                <th className="px-4 py-3 text-left">Verlies</th>
                <th className="px-4 py-3 text-left">Win%</th>
                <th className="px-4 py-3 text-left">Punten (+)</th>
                <th className="px-4 py-3 text-left">Punten (-)</th>
                <th className="px-4 py-3 text-left">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => (
                <tr key={entry.player.id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-semibold text-white">
                    {entry.player.name}
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {typeof entry.rating === "number" ? entry.rating : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-200">{entry.matches}</td>
                  <td className="px-4 py-3 text-emerald-300">{entry.wins}</td>
                  <td className="px-4 py-3 text-rose-300">{entry.losses}</td>
                  <td className="px-4 py-3 text-slate-200">
                    {percentageFormatter.format(entry.winRate)}
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {entry.pointsFor}
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {entry.pointsAgainst}
                  </td>
                  <td
                    className={`px-4 py-3 font-semibold ${
                      entry.pointDifferential >= 0
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    {entry.pointDifferential >= 0 ? "+" : ""}
                    {entry.pointDifferential}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
