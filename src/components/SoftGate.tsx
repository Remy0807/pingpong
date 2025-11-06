import { useEffect, useRef, useState } from "react";

export function SoftGate({ children }: { children: React.ReactNode }) {
  const [granted, setGranted] = useState<boolean>(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"choice" | "download" | "login">("choice");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const flag = sessionStorage.getItem("pp_access_granted");
      if (flag === "1") {
        setGranted(true);
      }
    } catch (e) {
      // ignore sessionStorage errors
    }
  }, []);

  const check = () => {
    // simple, intentional plaintext check as requested
    if (value.toUpperCase() === "AXOFT") {
      try {
        sessionStorage.setItem("pp_access_granted", "1");
      } catch (e) {
        // ignore
      }
      setGranted(true);
      setError(null);
    } else {
      setError("Onjuiste code");
    }
  };

  useEffect(() => {
    if (view === "login") {
      inputRef.current?.focus();
    } else {
      setError(null);
    }
  }, [view]);

  if (granted) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-center">
        {view === "choice" ? (
          <>
            <h2 className="text-lg font-semibold text-white">
              Waar wil je naartoe?
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Maak een keuze om verder te gaan.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setView("download")}
                className="inline-flex w-full items-center justify-center rounded-lg border border-axoft-400/60 bg-slate-800/70 px-4 py-3 text-sm font-semibold text-axoft-100 transition hover:border-axoft-300 hover:text-white"
              >
                Boozeboard app downloaden
              </button>
              <button
                type="button"
                onClick={() => setView("login")}
                className="inline-flex w-full items-center justify-center rounded-lg bg-axoft-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400"
              >
                Log in op het Ping Pong dashboard
              </button>
            </div>
          </>
        ) : null}

        {view === "download" ? (
          <>
            <h2 className="text-lg font-semibold text-white">
              Boozeboard app downloaden
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Haal de app op via de juiste store.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <a
                href="https://apps.apple.com/nl/app/boozeboard/id6742513717"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-lg bg-white/90 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
              >
                Download voor iOS
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.remyvk.biertracker&hl=nl"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Download voor Android
              </a>
            </div>
            <button
              type="button"
              onClick={() => setView("choice")}
              className="mt-6 inline-flex items-center justify-center text-sm font-medium text-axoft-100 hover:text-white"
            >
              Terug naar keuze
            </button>
          </>
        ) : null}

        {view === "login" ? (
          <>
            <h2 className="text-lg font-semibold text-white">
              Toegangscode vereist
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Voer de toegangscode in om verder te gaan.
            </p>

            <div className="mt-4">
              <input
                type="text"
                aria-label="Toegangscode"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") check();
                }}
                ref={inputRef}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white focus:outline-none"
              />
            </div>

            {error ? (
              <div className="mt-2 text-sm text-rose-400">{error}</div>
            ) : null}

            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={check}
                className="inline-flex items-center justify-center rounded-lg bg-axoft-500 px-4 py-2 text-sm font-semibold text-slate-950"
              >
                Bevestigen
              </button>
            </div>
            <button
              type="button"
              onClick={() => setView("choice")}
              className="mt-6 inline-flex items-center justify-center text-sm font-medium text-axoft-100 hover:text-white"
            >
              Terug naar keuze
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default SoftGate;
