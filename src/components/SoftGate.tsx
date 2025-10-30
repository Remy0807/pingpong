import { useEffect, useState } from "react";

export function SoftGate({ children }: { children: React.ReactNode }) {
  const [granted, setGranted] = useState<boolean>(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  if (granted) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-center">
        <h2 className="text-lg font-semibold text-white">
          Toegangscode vereist
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Voer de toegangscode in om verder te gaan.
        </p>

        <div className="mt-4">
          <input
            autoFocus
            type="text"
            aria-label="Toegangscode"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") check();
            }}
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
      </div>
    </div>
  );
}

export default SoftGate;
