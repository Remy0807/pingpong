import { useMemo } from "react";
import { useAppData } from "../context/AppDataContext";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function WallOfShamePage() {
  const { matches } = useAppData();

  const shameMatches = useMemo(() => {
    return matches
      .filter(
        (match) =>
          (match.playerOnePoints === 11 && match.playerTwoPoints === 0) ||
          (match.playerOnePoints === 0 && match.playerTwoPoints === 11)
      )
      .sort(
        (a, b) =>
          new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
      );
  }, [matches]);

  const loserStats = useMemo(() => {
    const stats = new Map<
      number,
      { id: number; name: string; losses: number; latestLossAt: string }
    >();

    shameMatches.forEach((match) => {
      const loser =
        match.playerOnePoints === 0 ? match.playerOne : match.playerTwo;
      const existing = stats.get(loser.id);
      if (!existing) {
        stats.set(loser.id, {
          id: loser.id,
          name: loser.name,
          losses: 1,
          latestLossAt: match.playedAt,
        });
        return;
      }

      existing.losses += 1;
      if (new Date(match.playedAt) > new Date(existing.latestLossAt)) {
        existing.latestLossAt = match.playedAt;
      }
    });

    return Array.from(stats.values()).sort((a, b) => {
      if (b.losses === a.losses) {
        return (
          new Date(b.latestLossAt).getTime() -
          new Date(a.latestLossAt).getTime()
        );
      }
      return b.losses - a.losses;
    });
  }, [shameMatches]);

  const podium = loserStats.slice(0, 3);

  return (
    <div className="space-y-6">
      <header className="glass-card relative overflow-hidden rounded-2xl border border-rose-500/30 bg-slate-950 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.28),rgba(2,6,23,0.98)_55%)]" />
        <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-48 w-48 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.42em] text-rose-200/80">
            Hall of pain
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-white">
            Wall of Shame
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Uitslagen met volledige vernedering: 11-0. Hier vergeet niemand wat
            er gebeurde.
          </p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100">
            <span className="h-2 w-2 rounded-full bg-rose-300" />
            {shameMatches.length}{" "}
            {shameMatches.length === 1 ? "afstraffing" : "afstraffingen"}
          </p>
        </div>
      </header>

      {!podium.length ? null : (
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Podium der schaamte</h3>
            <p className="text-sm text-slate-400">
              Spelers met de meeste 11-0 nederlagen.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {podium.map((entry, index) => {
              const rank = index + 1;
              const rankStyle =
                rank === 1
                  ? "border-amber-300/45 bg-amber-400/10 md:-translate-y-3"
                  : rank === 2
                    ? "border-slate-300/35 bg-slate-200/10"
                    : "border-orange-300/35 bg-orange-400/10";

              return (
                <article
                  key={entry.id}
                  className={`glass-card rounded-2xl border p-5 ${rankStyle}`}
                >
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-300/90">
                    #{rank}
                  </p>
                  <h4 className="mt-2 text-xl font-semibold text-white">
                    {entry.name}
                  </h4>
                  <p className="mt-1 text-sm text-slate-300">
                    {entry.losses}x met 11-0 verloren
                  </p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-slate-400">
                    Laatste keer: {formatDateTime(entry.latestLossAt)}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!shameMatches.length ? (
        <div className="glass-card rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-8 text-center text-sm text-slate-300">
          Nog geen 11-0 uitslagen. Iedereen is voorlopig veilig.
        </div>
      ) : (
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Shame register</h3>
            <p className="text-sm text-slate-400">
              Complete lijst van alle 11-0 uitslagen.
            </p>
          </div>
          <div className="grid gap-4">
            {shameMatches.map((match) => {
              const loser =
                match.playerOnePoints === 0 ? match.playerOne : match.playerTwo;
              const winner =
                match.playerOnePoints === 11 ? match.playerOne : match.playerTwo;

              return (
                <article
                  key={match.id}
                  className="glass-card rounded-2xl border border-rose-400/20 bg-gradient-to-r from-rose-950/35 via-slate-950/60 to-slate-950/50 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-rose-200/80">
                        {formatDateTime(match.playedAt)}
                      </p>
                      <h4 className="mt-1 text-xl font-semibold text-white">
                        {loser.name} kreeg een 11-0 tegen {winner.name}
                      </h4>
                      <p className="mt-1 text-xs text-slate-400">
                        Seizoen: {match.season?.name ?? "Onbekend"}
                      </p>
                    </div>
                    <div className="inline-flex min-w-[150px] flex-col items-center rounded-xl border border-rose-300/35 bg-rose-500/10 px-4 py-3">
                      <span className="text-2xl font-bold text-white">
                        {match.playerOnePoints} - {match.playerTwoPoints}
                      </span>
                      <span className="mt-1 text-xs uppercase tracking-[0.25em] text-rose-200">
                        total shutdown
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
