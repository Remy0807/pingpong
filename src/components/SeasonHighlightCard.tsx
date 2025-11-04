import type { Match } from "../types";

type SeasonHighlightProps = {
  match: Match;
  title?: string;
  subtitle?: string;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function SeasonHighlightCard({
  match,
  title = "Match van het seizoen",
  subtitle,
}: SeasonHighlightProps) {
  const totalPoints = match.playerOnePoints + match.playerTwoPoints;

  return (
    <article className="glass-card flex flex-col gap-4 rounded-2xl border border-axoft-500/10 bg-slate-950/50 p-5 text-sm text-slate-200 shadow-card">
      <header>
        <p className="text-xs uppercase tracking-widest text-axoft-200">
          {title}
        </p>
        <h3 className="text-lg font-semibold text-white">
          {match.playerOne.name} vs {match.playerTwo.name}
        </h3>
        <p className="text-xs text-slate-400">
          {subtitle ?? `Meeste punten in één duel (${totalPoints} totaal)`}
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-axoft-200">
            Eindstand
          </p>
          <p className="text-base font-semibold text-white">
            {match.playerOnePoints} – {match.playerTwoPoints}
          </p>
          <p className="text-xs text-slate-400">
            Winnaar: {match.winner.name}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-axoft-200">
            Gespeeld op
          </p>
          <p className="text-base font-semibold text-white">
            {formatDate(match.playedAt)}
          </p>
          <p className="text-xs text-slate-400">
            Δ Elo:{" "}
            {match.playerOneEloDelta != null
              ? `${match.playerOneEloDelta >= 0 ? "+" : ""}${
                  match.playerOneEloDelta
                } (${match.playerOne.name})`
              : "n.v.t."}
          </p>
        </div>
      </div>
      <p className="rounded-lg border border-white/5 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
        Seizoen: {match.season?.name ?? "Onbekend"}
      </p>
    </article>
  );
}
