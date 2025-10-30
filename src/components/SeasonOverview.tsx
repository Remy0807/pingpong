import type { SeasonSummary } from "../types";

type SeasonOverviewProps = {
  seasons: SeasonSummary[];
  currentSeasonId: number | null;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const percentage = (value: number) => `${Math.round(value * 100)}%`;

export function SeasonOverview({
  seasons,
  currentSeasonId,
}: SeasonOverviewProps) {
  if (!seasons.length) {
    return (
      <section className="glass-card rounded-2xl border border-white/10 p-6 text-sm text-slate-400">
        Seizoensstatistieken verschijnen zodra er wedstrijden zijn ingevoerd.
      </section>
    );
  }

  const currentSeason =
    seasons.find((season) => season.id === currentSeasonId) ??
    seasons[0] ??
    null;
  const previousSeasons = seasons.filter(
    (season) => season.id !== currentSeason?.id
  );

  return (
    <section className="space-y-6">
      {currentSeason ? (
        <div className="glass-card rounded-2xl border border-white/10 p-6">
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-axoft-200">
                Huidig seizoen
              </p>
              <h3 className="text-2xl font-semibold text-white">
                {currentSeason.name}
              </h3>
              <p className="text-sm text-slate-400">
                {formatDate(currentSeason.startDate)} –{" "}
                {formatDate(currentSeason.endDate)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
              <p className="text-xs uppercase tracking-widest text-slate-400">
                Wedstrijden
              </p>
              <p className="text-lg font-semibold text-white">
                {currentSeason.matches}
              </p>
              <p className="text-xs text-slate-500">totaal deze maand</p>
            </div>
          </header>

          <div className="mt-6 space-y-2">
            <p className="text-xs uppercase tracking-widest text-axoft-200">
              Top 3
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {currentSeason.standings.slice(0, 3).map((standing, index) => (
                <div
                  key={standing.player.id}
                  className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200"
                >
                  <p className="text-xs uppercase tracking-widest text-axoft-300">
                    #{index + 1}
                  </p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {standing.player.name}
                    <span className="ml-2 text-xs font-medium text-slate-400">
                      {standing.rating} Elo
                    </span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {standing.wins}–{standing.losses} (
                    {percentage(standing.winRate)})
                  </p>
                  <p
                    className={`mt-2 text-xs font-semibold ${
                      standing.pointDifferential >= 0
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    Saldo {standing.pointDifferential >= 0 ? "+" : ""}
                    {standing.pointDifferential}
                  </p>
                </div>
              ))}
              {currentSeason.standings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                  Nog geen wedstrijden dit seizoen.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {previousSeasons.length ? (
        <div className="glass-card rounded-2xl border border-white/10 p-6">
          <h4 className="text-lg font-semibold text-white">Vorige seizoenen</h4>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            {previousSeasons.map((season) => (
              <li
                key={season.id}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-white">
                    {season.name}
                  </p>
                  <p className="text-xs uppercase tracking-widest text-slate-400">
                    {formatDate(season.startDate)} –{" "}
                    {formatDate(season.endDate)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-xs">
                    Wedstrijden:{" "}
                    <span className="font-semibold">{season.matches}</span>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-xs">
                    Kampioen:{" "}
                    <span className="font-semibold">
                      {season.champion
                        ? season.champion.name
                        : "Nog niet bepaald"}
                    </span>
                  </div>
                  {/* Show top player's Elo if available */}
                  {season.standings && season.standings[0] ? (
                    <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-xs">
                      Top rating:{" "}
                      <span className="font-semibold">
                        {season.standings[0].rating} Elo
                      </span>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
