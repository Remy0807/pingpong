import { NavLink, Outlet } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";

const navLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/matches", label: "Wedstrijden" },
  { to: "/players", label: "Spelers" },
  { to: "/head-to-head", label: "Onderlinge resultaten" },
  { to: "/recommendations", label: "Aanbevolen duels" }
];

export function AppLayout() {
  const { players, matches, error, loading } = useAppData();

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,128,152,0.45),rgba(15,23,42,1)_60%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-8 lg:px-6">
        <header className="flex flex-col gap-6 rounded-2xl border border-white/5 bg-slate-950/40 p-6 shadow-card backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.6em] text-axoft-200">Axoft Pingpong</p>
            <h1 className="text-3xl font-semibold text-white md:text-4xl">
              Houd de competitie scherp &amp; overzichtelijk
            </h1>
            <p className="max-w-xl text-sm text-slate-300">
              Registreer potjes, analyseer statistieken en ontdek wie binnen Axoft de ultieme
              pingpongkampioen is.
            </p>
          </div>
          <div className="flex flex-col gap-4 md:min-w-[220px]">
            <nav className="-mx-2 flex snap-x snap-mandatory items-center gap-2 overflow-x-auto px-2 pb-1 md:flex-wrap md:overflow-visible">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `snap-start whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-axoft-500 text-slate-950 shadow-card"
                        : "border border-white/10 bg-slate-950/50 text-slate-200 hover:border-axoft-400 hover:text-axoft-100"
                    }`
                  }
                  end={link.to === "/"}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="glass-card flex flex-col gap-2 rounded-xl p-4 text-sm text-white">
              <span className="text-xs uppercase tracking-widest text-axoft-200/80">Totaal</span>
              <div className="flex justify-between">
                <span className="text-slate-300">Spelers</span>
                <span className="font-semibold">{players.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Potjes</span>
                <span className="font-semibold">{matches.length}</span>
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
          <Outlet />
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
