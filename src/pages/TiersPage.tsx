import { Link } from "react-router-dom";
import { BadgeLegend } from "../components/BadgeLegend";
import { useAppData } from "../context/AppDataContext";
import { usePortal } from "../context/PortalContext";
import { tierLadder } from "../lib/tiers";

const numberFormatter = new Intl.NumberFormat("nl-NL", {
  maximumFractionDigits: 0,
});

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function formatDelta(delta: number) {
  return `${delta >= 0 ? "+" : ""}${numberFormatter.format(delta)} Elo`;
}

type SeasonMover = {
  player: {
    id: number;
    name: string;
  };
  rating: number;
  wins: number;
  losses: number;
  matches: number;
  pointsFor: number;
  pointsAgainst: number;
  winRate: number;
  pointDifferential: number;
  delta: number;
  previousRating: number;
};

export function TiersPage() {
  const { players, seasons, currentSeasonId } = useAppData();
  const { activeGroup } = usePortal();

  const activeSeason =
    (currentSeasonId != null
      ? seasons.find((season) => season.id === currentSeasonId) ?? null
      : null) ?? seasons[0] ?? null;

  const previousSeason = activeSeason
    ? ([...seasons]
        .filter((season) => season.id !== activeSeason.id)
        .sort(
          (a, b) =>
            new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
        )[0] ?? null)
    : null;

  const previousSeasonRatings = new Map<number, number>(
    previousSeason?.standings.map((standing) => [
      standing.player.id,
      standing.rating,
    ]) ?? [],
  );

  const currentSeasonMovers = (activeSeason?.standings ?? [])
    .map((standing) => {
      const previousRating = previousSeasonRatings.get(standing.player.id);
      if (previousRating == null) {
        return null;
      }
      return {
        ...standing,
        delta: standing.rating - previousRating,
        previousRating,
      } as SeasonMover;
    })
    .filter((entry): entry is SeasonMover => entry != null);

  const moversUp = [...currentSeasonMovers]
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);
  const moversDown = [...currentSeasonMovers]
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5);

  const seasonChampions = [...seasons].sort(
    (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
  );

  const badgeLeaders = [...players]
    .filter((player) => player.badges.length > 0)
    .sort(
      (a, b) =>
        b.badges.length - a.badges.length ||
        b.championships - a.championships ||
        b.wins - a.wins,
    )
    .slice(0, 6);

  if (!activeGroup) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
          Rangen
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">
          Kies eerst een groep
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          Tier ladders, promotie en degradatie horen bij een specifieke groep.
          Selecteer een groep om de ladder en prestaties te bekijken.
        </p>
        <div className="mt-5">
          <Link
            to="/"
            className="rounded-2xl bg-axoft-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400"
          >
            Naar dashboard
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
          Rangen
        </p>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-white">
              {activeGroup.name}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Hier zie je de tier ladder, de spelers die omhoog of omlaag gaan,
              de kampioenen per seizoen en welke prestaties badges opleveren.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Ladder tiers
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {tierLadder.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Badges
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {players.reduce((sum, player) => sum + player.badges.length, 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Seizoenen
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {seasons.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
            Tier ladder
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Elo-grenzen per tier
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tierLadder.map((tier) => (
            <article
              key={tier.key}
              className={`rounded-2xl border p-5 shadow-card ${tier.accentClass}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] opacity-70">
                    Tier
                  </p>
                  <h4 className="mt-2 text-2xl font-semibold">{tier.label}</h4>
                </div>
                <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs font-medium">
                  {tier.maxRating == null
                    ? `${tier.minRating}+`
                    : `${tier.minRating}–${tier.maxRating}`}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 opacity-90">
                {tier.description}
              </p>
              <p className="mt-4 text-xs uppercase tracking-[0.35em] opacity-70">
                Voorbeeld: {tier.label}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
                Beweging
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Wie stijgt en daalt
              </h3>
            </div>
            <p className="text-sm text-slate-400">
              {previousSeason ? previousSeason.name : "Geen vorige seizoen"}
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">
                Stijgers
              </p>
              <div className="mt-3 space-y-3">
                {moversUp.length ? (
                  moversUp.map((entry, index) => (
                    <div
                      key={entry.player.id}
                      className="rounded-xl border border-white/5 bg-slate-950/50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">
                          #{index + 1} {entry.player.name}
                        </p>
                        <span className="text-sm font-semibold text-emerald-300">
                          {formatDelta(entry.delta)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {entry.previousRating} → {entry.rating} Elo
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">
                    Nog geen vergelijkbare data.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-rose-200">
                Dalers
              </p>
              <div className="mt-3 space-y-3">
                {moversDown.length ? (
                  moversDown.map((entry, index) => (
                    <div
                      key={entry.player.id}
                      className="rounded-xl border border-white/5 bg-slate-950/50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">
                          #{index + 1} {entry.player.name}
                        </p>
                        <span className="text-sm font-semibold text-rose-300">
                          {formatDelta(entry.delta)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {entry.previousRating} → {entry.rating} Elo
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">
                    Nog geen vergelijkbare data.
                  </p>
                )}
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
            Seizoenen
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Kampioenen per seizoen
          </h3>
          <div className="mt-5 space-y-3">
            {seasonChampions.map((season) => (
              <div
                key={season.id}
                className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">{season.name}</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      {formatDate(season.startDate)} – {formatDate(season.endDate)}
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs font-medium text-slate-200">
                    Kampioen:{" "}
                    <span className="font-semibold text-white">
                      {season.champion ? season.champion.name : "Nog niet bepaald"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <BadgeLegend />
        <article className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.4em] text-axoft-200">
            Prestaties
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Meeste badges
          </h3>
          <div className="mt-5 space-y-3">
            {badgeLeaders.length ? (
              badgeLeaders.map((player, index) => (
                <div
                  key={player.player.id}
                  className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                        #{index + 1}
                      </p>
                      <h4 className="mt-1 text-lg font-semibold text-white">
                        {player.player.name}
                      </h4>
                    </div>
                    <div className="rounded-full border border-axoft-300/20 bg-axoft-500/10 px-3 py-1 text-xs font-semibold text-axoft-100">
                      {player.badges.length} badges
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {player.championships} titels · {player.currentStreak} winst
                    streak
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {player.badges.slice(0, 4).map((badge) => (
                      <span
                        key={badge.id}
                        className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs text-slate-200"
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                Nog geen badges verdiend in deze groep.
              </p>
            )}
          </div>

          {players.length ? (
            <p className="mt-5 text-xs text-slate-500">
              De rangindeling volgt de Elo-grenzen van de ladder hierboven en
              badges worden automatisch per speler verzameld.
            </p>
          ) : null}
        </article>
      </section>
    </div>
  );
}
