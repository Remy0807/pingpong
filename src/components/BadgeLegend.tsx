import { useState } from "react";

const badgeDescriptions: Record<string, string> = {
  "In vorm": "Actieve winstreak van minimaal drie wedstrijden.",
  "Perfecte maand": "Minstens drie wedstrijden gespeeld en geen enkele verloren.",
  Dominantie:
    "Ten minste vijf wedstrijden gespeeld en 75% daarvan gewonnen in het seizoen.",
  Marathonspeler: "Tien of meer wedstrijden in hetzelfde seizoen gespeeld.",
  Winmachine: "Een winstreak van vijf of meer op enig moment bereikt.",
};

export function BadgeLegend() {
  const [open, setOpen] = useState(false);

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
        <dl className="mt-4 space-y-3">
          {Object.entries(badgeDescriptions).map(([badge, description]) => (
            <div
              key={badge}
              className="rounded-xl border border-white/5 bg-slate-950/70 px-3 py-2"
            >
              <dt className="text-xs uppercase tracking-widest text-axoft-300">
                {badge}
              </dt>
              <dd className="mt-1 text-xs text-slate-300">{description}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
