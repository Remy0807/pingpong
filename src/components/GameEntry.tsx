import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function GameEntry() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const c = code.trim();
    if (!c) return;
    navigate(`/game/${encodeURIComponent(c.toUpperCase())}`);
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
