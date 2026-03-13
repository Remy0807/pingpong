import { useMemo, useState } from "react";
import { badgeList } from "../../shared/badges";

export function BadgeLegend() {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => {
    return badgeList.reduce(
      (acc, badge) => {
        if (!acc[badge.category]) {
          acc[badge.category] = [];
        }
        acc[badge.category].push(badge);
        return acc;
      },
      {} as Record<string, typeof badgeList[number][]>
    );
  }, []);

  return (
    <div className="glass-card rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">
            Badges uitgelegd
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Ontdek hoe je badges verdient tijdens een seizoen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs font-medium text-axoft-100 transition hover:border-axoft-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-axoft-400/60"
        >
          {open ? "Verberg" : "Toon"}
        </button>
      </div>
      {open ? (
        <div className="mt-4 space-y-4">
          {Object.entries(grouped).map(([category, badges]) => (
            <section key={category}>
              <h4 className="text-[11px] uppercase tracking-[0.4em] text-axoft-200/80">
                {category}
              </h4>
              <dl className="mt-2 space-y-3">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="rounded-xl border border-white/5 bg-slate-950/70 px-3 py-2"
                  >
                    <dt className="text-xs font-semibold uppercase tracking-widest text-axoft-300">
                      {badge.label}
                    </dt>
                    <dd className="mt-1 text-xs text-slate-300">
                      {badge.description}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
