import { useEffect, useMemo, useState } from "react";
import type { PlayerStats } from "../types";

export type MatchFormValues = {
  playerOneId: number;
  playerTwoId: number;
  playerOnePoints: number;
  playerTwoPoints: number;
  playedAt?: string;
};

type MatchFormProps = {
  players: PlayerStats[];
  onSubmit: (match: MatchFormValues) => Promise<void> | void;
  loading?: boolean;
  submitLabel?: string;
  title?: string;
  description?: string;
  showHeader?: boolean;
  headerBadge?: string;
  initialValues?: MatchFormValues;
  onCancel?: () => void;
  className?: string;
};

const defaultPoints = { playerOnePoints: 11, playerTwoPoints: 7 };

const toDateTimeLocal = (value: Date | string | undefined) => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (num: number) => String(num).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function MatchForm({
  players,
  onSubmit,
  loading,
  submitLabel = "Resultaat opslaan",
  title = "Nieuw potje registreren",
  description = "Noteer de winnaar en het aantal punten. De standen worden automatisch bijgewerkt.",
  showHeader = true,
  headerBadge = "Resultaat",
  initialValues,
  onCancel,
  className
}: MatchFormProps) {
  const [playerOneId, setPlayerOneId] = useState<number | null>(initialValues?.playerOneId ?? null);
  const [playerTwoId, setPlayerTwoId] = useState<number | null>(initialValues?.playerTwoId ?? null);
  const [playerOnePoints, setPlayerOnePoints] = useState<string>(
    initialValues?.playerOnePoints?.toString() ?? defaultPoints.playerOnePoints.toString()
  );
  const [playerTwoPoints, setPlayerTwoPoints] = useState<string>(
    initialValues?.playerTwoPoints?.toString() ?? defaultPoints.playerTwoPoints.toString()
  );
  const [playedAt, setPlayedAt] = useState<string>(
    toDateTimeLocal(initialValues?.playedAt ?? new Date())
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialValues) {
      return;
    }
    setPlayerOneId(initialValues.playerOneId);
    setPlayerTwoId(initialValues.playerTwoId);
    setPlayerOnePoints(initialValues.playerOnePoints.toString());
    setPlayerTwoPoints(initialValues.playerTwoPoints.toString());
    setPlayedAt(toDateTimeLocal(initialValues.playedAt));
  }, [initialValues]);

  useEffect(() => {
    if (initialValues) {
      return;
    }
    setPlayedAt(toDateTimeLocal(new Date()));
  }, [initialValues]);

  const playerOptions = useMemo(
    () =>
      players.map((stats) => ({
        value: stats.player.id,
        label: stats.player.name
      })),
    [players]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (playerOneId == null || playerTwoId == null) {
      setError("Selecteer twee spelers.");
      return;
    }

    if (playerOneId === playerTwoId) {
      setError("Een speler kan niet tegen zichzelf spelen.");
      return;
    }

    if (!playerOnePoints || !playerTwoPoints) {
      setError("Vul voor beide spelers een score in.");
      return;
    }

    const playerOnePointsValue = Number(playerOnePoints);
    const playerTwoPointsValue = Number(playerTwoPoints);

    if (Number.isNaN(playerOnePointsValue) || Number.isNaN(playerTwoPointsValue)) {
      setError("Scores moeten numeriek zijn.");
      return;
    }

    if (playerOnePointsValue === playerTwoPointsValue) {
      setError("Een potje kan niet in een gelijkspel eindigen.");
      return;
    }

    if (playerOnePointsValue < 0 || playerTwoPointsValue < 0) {
      setError("Scores kunnen niet negatief zijn.");
      return;
    }

    try {
      setError(null);
      await onSubmit({
        playerOneId,
        playerTwoId,
        playerOnePoints: playerOnePointsValue,
        playerTwoPoints: playerTwoPointsValue,
        playedAt: playedAt ? new Date(playedAt).toISOString() : undefined
      });

      if (!initialValues) {
        setPlayerOneId(null);
        setPlayerTwoId(null);
        setPlayerOnePoints(defaultPoints.playerOnePoints.toString());
        setPlayerTwoPoints(defaultPoints.playerTwoPoints.toString());
        setPlayedAt(toDateTimeLocal(new Date()));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    }
  };

  const swapPlayers = () => {
    setPlayerOneId(playerTwoId);
    setPlayerTwoId(playerOneId);
    setPlayerOnePoints(playerTwoPoints);
    setPlayerTwoPoints(playerOnePoints);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={className ?? "glass-card rounded-xl p-6 space-y-5"}
    >
      {showHeader ? (
        <header className="flex flex-col gap-1">
          {headerBadge ? (
            <span className="text-xs uppercase tracking-widest text-axoft-300">
              {headerBadge}
            </span>
          ) : null}
          {title ? <h2 className="text-xl font-semibold">{title}</h2> : null}
          {description ? <p className="text-sm text-slate-400">{description}</p> : null}
        </header>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Datum &amp; tijd</label>
        <input
          type="datetime-local"
          value={playedAt}
          onChange={(event) => setPlayedAt(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
        />
        <p className="text-xs text-slate-500">
          Standaard wordt de huidige tijd ingevuld. Pas aan indien nodig of verwijder de waarde om
          nu te gebruiken. Bewerk een bestaande wedstrijd om een foutief moment te corrigeren.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Speler A</label>
          <select
            value={playerOneId ?? ""}
            onChange={(event) => setPlayerOneId(Number(event.target.value) || null)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
          >
            <option value="">Kies een speler</option>
            {playerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Speler B</label>
          <select
            value={playerTwoId ?? ""}
            onChange={(event) => setPlayerTwoId(Number(event.target.value) || null)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
          >
            <option value="">Kies een speler</option>
            {playerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Score speler A</label>
          <input
            type="number"
            value={playerOnePoints}
            min={0}
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="next"
            onChange={(event) => setPlayerOnePoints(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Score speler B</label>
          <input
            type="number"
            value={playerTwoPoints}
            min={0}
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            onChange={(event) => setPlayerTwoPoints(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button
          type="button"
          onClick={swapPlayers}
          className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
        >
          Wissel spelers
        </button>
        <div className="flex flex-1 items-center justify-end gap-3">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
            >
              Annuleren
            </button>
          ) : null}
          <button
            type="submit"
            disabled={loading || players.length < 2}
            className="inline-flex items-center justify-center rounded-lg bg-axoft-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500 disabled:cursor-not-allowed disabled:bg-axoft-500/60"
          >
            {loading ? "Opslaan..." : submitLabel}
          </button>
        </div>
      </div>

      {players.length < 2 ? (
        <p className="text-sm text-amber-400">
          Voeg minimaal twee spelers toe om een potje te registreren.
        </p>
      ) : null}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </form>
  );
}
