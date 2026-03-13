import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";

const primaryNavLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/matches", label: "Wedstrijden" },
  { to: "/doubles", label: "2v2" },
  { to: "/players", label: "Spelers" },
];

const secondaryNavLinks = [
  { to: "/head-to-head", label: "Onderlinge resultaten" },
  { to: "/recommendations", label: "Aanbevolen duels" },
  { to: "/elo-simulator", label: "Elo simulator" },
  { to: "/wall-of-shame", label: "Wall of Shame" },
];

export function AppLayout() {
  const { players, matches, doublesMatches, error, loading } = useAppData();
  const totalMatches = matches.length + doublesMatches.length;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!moreMenuRef.current) {
        return;
      }
      if (
        moreOpen &&
        event.target instanceof Node &&
        !moreMenuRef.current.contains(event.target)
      ) {
        setMoreOpen(false);
      }
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [moreOpen]);

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,128,152,0.45),rgba(15,23,42,1)_60%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-8 lg:px-6">
        <header className="flex flex-col gap-6 rounded-2xl border border-white/5 bg-slate-950/40 p-6 shadow-card backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.6em] text-axoft-200">
              PingPong Scores
            </p>
            <h1 className="text-3xl font-semibold text-white md:text-4xl">
              Houd de competitie scherp &amp; overzichtelijk
            </h1>
            <p className="max-w-xl text-sm text-slate-300">
              Registreer potjes, analyseer statistieken en ontdek wie binnen
              Axoft de ultieme pingpongkampioen is.
            </p>
          </div>
          <div className="flex flex-col gap-4 md:min-w-[220px]">
            <nav className="relative z-20 -mx-2 flex snap-x snap-mandatory items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60 px-2 py-2 backdrop-blur md:flex-wrap md:overflow-visible">
              {primaryNavLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `snap-start whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-axoft-500 text-slate-950 shadow-card"
                        : "text-slate-200 hover:text-white"
                    }`
                  }
                  end={link.to === "/"}
                >
                  {link.label}
                </NavLink>
              ))}
              <div className="relative snap-start" ref={moreMenuRef}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((prev) => !prev)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    moreOpen
                      ? "bg-axoft-500 text-slate-950 shadow-card"
                      : "text-slate-200 hover:text-white"
                  }`}
                  aria-expanded={moreOpen}
                >
                  Meer
                  <span aria-hidden className="text-xs font-mono">
                    {moreOpen ? "–" : "+"}
                  </span>
                </button>
                {moreOpen ? (
                  <div className="absolute left-0 top-full z-30 mt-3 w-64 rounded-2xl border border-white/10 bg-slate-950/90 p-3 text-sm shadow-2xl backdrop-blur">
                    <p className="px-2 pb-2 text-xs uppercase tracking-[0.3em] text-axoft-200/60">
                      Meer tools
                    </p>
                    <div className="space-y-1">
                      {secondaryNavLinks.map((link) => (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          onClick={() => setMoreOpen(false)}
                          className={({ isActive }) =>
                            `block rounded-xl px-3 py-2 transition ${
                              isActive
                                ? "bg-axoft-500/90 text-slate-950"
                                : "text-slate-200 hover:bg-slate-900/80"
                            }`
                          }
                        >
                          {link.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </nav>
            <div className="glass-card flex flex-col gap-2 rounded-xl p-4 text-sm text-white">
              <span className="text-xs uppercase tracking-widest text-axoft-200/80">
                Totaal
              </span>
              <div className="flex justify-between">
                <span className="text-slate-300">Spelers</span>
                <span className="font-semibold">{players.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Potjes</span>
                <span className="font-semibold">{totalMatches}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Singles / 2v2</span>
                <span>
                  {matches.length} / {doublesMatches.length}
                </span>
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <main className="mt-8 flex-1">
          <div key={location.pathname} className="route-transition">
            <Outlet />
          </div>
        </main>

        {loading ? (
          <p className="mt-6 text-center text-xs uppercase tracking-[0.4em] text-slate-500">
            Gegevens worden geladen...
          </p>
        ) : null}
      </div>
    </div>
  );
}
