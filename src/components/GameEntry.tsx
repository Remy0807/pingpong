import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";

export function GameEntry() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const [allowedCodes, setAllowedCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setCurrentGameCode } = useAppData();

  useEffect(() => {
    let mounted = true;
    fetch("/api/games")
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (data && Array.isArray(data.codes)) {
          setAllowedCodes(
            data.codes.map((c: string) => String(c).toUpperCase())
          );
        } else {
          setAllowedCodes([]);
        }
      })
      .catch(() => {
        if (!mounted) return;
        // treat failure as 'no restriction' to avoid blocking usage
        setAllowedCodes([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const c = code.trim();
    if (!c) return;
    const upper = c.toUpperCase();

    // If allowedCodes is null we're still loading; prevent submit
    if (allowedCodes === null) {
      setError("Bezig met laden, probeer het even opnieuw.");
      return;
    }

    // If allowedCodes is empty array => no restriction
    if (allowedCodes.length > 0 && !allowedCodes.includes(upper)) {
      setError("Ongeldige gamecode.");
      return;
    }

    // persist and update context
    setCurrentGameCode(upper);
    navigate(`/game/${encodeURIComponent(upper)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-white/10 bg-slate-950/60 p-8"
      >
        <h2 className="text-2xl font-semibold text-white mb-4">
          Voer gamecode in
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          Voer de gamecode in om door te gaan (bv. AXOFT).
        </p>
        {allowedCodes !== null && allowedCodes.length > 0 ? (
          <p className="text-xs text-emerald-200 mb-4">
            Beschikbare gamecodes: {allowedCodes.join(", ")}
          </p>
        ) : null}
        {error ? <p className="text-sm text-rose-300 mb-4">{error}</p> : null}
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 rounded-md border border-white/10 bg-transparent px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none"
            placeholder="Bijv. AXOFT"
            aria-label="Game code"
          />
          <button
            type="submit"
            className="rounded-md bg-axoft-500 px-4 py-2 text-sm font-medium text-slate-900"
          >
            Ga
          </button>
        </div>
      </form>
    </div>
  );
}

export default GameEntry;
