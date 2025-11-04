import { useCallback, useEffect, useState } from "react";
import {
  getMatchRecommendations,
  type RecommendationsResponse,
} from "../lib/api";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("nl-NL", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Nog niet gespeeld";

export function RecommendationsPage() {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getMatchRecommendations();
      setData(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Kon aanbevelingen niet ophalen."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendations().catch((err) => {
      console.error(err);
    });
  }, [loadRecommendations]);

  const recommendations = data?.recommendations ?? [];

  return (
    <div className="space-y-6">
      <header className="glass-card flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-sm text-slate-200 shadow-card md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-axoft-200">
            Aanbevolen duels
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Wie moet er nu achter de tafel?
          </h2>
          <p className="mt-2 max-w-xl text-xs text-slate-400">
            Analyse gebaseerd op onderlinge resultaten, seizoens Elo en actuele
            vorm. Handig om de volgende spannende wedstrijd in te plannen.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs text-slate-300">
          {data ? (
            <>
              <span className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
                Seizoen:{" "}
                <span className="font-semibold text-white">
                  {data.season.name}
                </span>
              </span>
              <span className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
                Laatste update:{" "}
                <span className="font-semibold text-white">
                  {formatDateTime(data.generatedAt)}
                </span>
              </span>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => {
              loadRecommendations().catch((err) => {
                console.error(err);
              });
            }}
            className="rounded-lg border border-axoft-400/40 bg-axoft-500/10 px-3 py-2 text-xs font-semibold text-axoft-200 transition hover:border-axoft-300 hover:bg-axoft-500/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-axoft-300/60"
            disabled={loading}
          >
            {loading ? "Bezig..." : "Vernieuwen"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-center text-xs uppercase tracking-[0.4em] text-slate-500">
          Aanbevelingen laden...
        </p>
      ) : null}

      {!loading && !recommendations.length ? (
        <div className="glass-card rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-8 text-center text-sm text-slate-300">
          Geen aanbevelingen gevonden. Probeer later opnieuw zodra er meer
          onderlinge resultaten zijn.
        </div>
      ) : null}

      {recommendations.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {recommendations.map((recommendation, index) => (
            <article
              key={`${recommendation.playerOne.id}-${recommendation.playerTwo.id}`}
              className="glass-card flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-200 shadow-card"
            >
              <header className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-axoft-200">
                    #{index + 1} aanbevolen match
                  </p>
                  <h3 className="text-lg font-semibold text-white">
                    {recommendation.playerOne.name} vs{" "}
                    {recommendation.playerTwo.name}
                  </h3>
                </div>
                <span className="rounded-full bg-axoft-500/15 px-3 py-1 text-xs font-semibold text-axoft-200">
                  Score {recommendation.score}
                </span>
              </header>

              <dl className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-xs text-slate-300">
                <div>
                  <dt className="uppercase tracking-widest text-axoft-200/70">
                    Historie
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-white">
                    {recommendation.record.playerOneWins} -{" "}
                    {recommendation.record.playerTwoWins}
                  </dd>
                  <p className="text-[0.7rem] text-slate-400">
                    {recommendation.totalMeetings} potjes totaal
                  </p>
                </div>
                <div>
                  <dt className="uppercase tracking-widest text-axoft-200/70">
                    Laatste duel
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-white">
                    {formatDate(recommendation.lastPlayedAt)}
                  </dd>
                  <p className="text-[0.7rem] text-slate-400">
                    {recommendation.seasonMeetings} keer dit seizoen
                  </p>
                </div>
                <div>
                  <dt className="uppercase tracking-widest text-axoft-200/70">
                    Elo-verschil
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-white">
                    {recommendation.ratingDiff != null
                      ? `${recommendation.ratingDiff} punten`
                      : "n.v.t."}
                  </dd>
                </div>
              </dl>

              <ul className="space-y-2 text-xs text-slate-300">
                {recommendation.reasons.map((reason) => (
                  <li
                    key={reason}
                    className="flex items-start gap-2 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2"
                  >
                    <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-axoft-300" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
