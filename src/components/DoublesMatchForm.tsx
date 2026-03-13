import { useEffect, useMemo, useState } from "react";
import type { PlayerStats } from "../types";

export type DoublesMatchFormValues = {
  teamOnePlayerAId: number;
  teamOnePlayerBId: number;
  teamTwoPlayerAId: number;
  teamTwoPlayerBId: number;
  teamOnePoints: number;
  teamTwoPoints: number;
  playedAt?: string;
};

type DoublesMatchFormProps = {
  players: PlayerStats[];
  onSubmit: (match: DoublesMatchFormValues) => Promise<void> | void;
  loading?: boolean;
  submitLabel?: string;
  title?: string;
  description?: string;
  showHeader?: boolean;
  initialValues?: DoublesMatchFormValues;
  onCancel?: () => void;
  className?: string;
};

const defaultPoints = { teamOnePoints: 11, teamTwoPoints: 7 };

const toDateTimeLocal = (value: Date | string | undefined) => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function DoublesMatchForm({
  players,
  onSubmit,
  loading,
  submitLabel = "2v2 opslaan",
  title = "Nieuwe 2v2 registreren",
  description = "Kies twee teams, vul de teamscore in en het doubles leaderboard wordt automatisch bijgewerkt.",
  showHeader = true,
  initialValues,
  onCancel,
  className,
}: DoublesMatchFormProps) {
  const [teamOnePlayerAId, setTeamOnePlayerAId] = useState<number | null>(
    initialValues?.teamOnePlayerAId ?? null
  );
  const [teamOnePlayerBId, setTeamOnePlayerBId] = useState<number | null>(
    initialValues?.teamOnePlayerBId ?? null
  );
  const [teamTwoPlayerAId, setTeamTwoPlayerAId] = useState<number | null>(
    initialValues?.teamTwoPlayerAId ?? null
  );
  const [teamTwoPlayerBId, setTeamTwoPlayerBId] = useState<number | null>(
    initialValues?.teamTwoPlayerBId ?? null
  );
  const [teamOnePoints, setTeamOnePoints] = useState(
    initialValues?.teamOnePoints ?? defaultPoints.teamOnePoints
  );
  const [teamTwoPoints, setTeamTwoPoints] = useState(
    initialValues?.teamTwoPoints ?? defaultPoints.teamTwoPoints
  );
  const [playedAt, setPlayedAt] = useState<string>(
    toDateTimeLocal(initialValues?.playedAt ?? new Date())
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialValues) {
      return;
    }

    setTeamOnePlayerAId(initialValues.teamOnePlayerAId);
    setTeamOnePlayerBId(initialValues.teamOnePlayerBId);
    setTeamTwoPlayerAId(initialValues.teamTwoPlayerAId);
    setTeamTwoPlayerBId(initialValues.teamTwoPlayerBId);
    setTeamOnePoints(initialValues.teamOnePoints);
    setTeamTwoPoints(initialValues.teamTwoPoints);
    setPlayedAt(toDateTimeLocal(initialValues.playedAt));
  }, [initialValues]);

  const options = useMemo(
    () =>
      players.map((entry) => ({
        value: entry.player.id,
        label: entry.player.name,
      })),
    [players]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const selectedIds = [
      teamOnePlayerAId,
      teamOnePlayerBId,
      teamTwoPlayerAId,
      teamTwoPlayerBId,
    ];

    if (selectedIds.some((playerId) => playerId == null)) {
      setError("Selecteer vier spelers.");
      return;
    }

    if (new Set(selectedIds).size !== 4) {
      setError("Een 2v2-potje vereist vier unieke spelers.");
      return;
    }

    if (teamOnePoints === teamTwoPoints) {
      setError("Een potje kan niet in een gelijkspel eindigen.");
      return;
    }

    if (teamOnePoints < 0 || teamTwoPoints < 0) {
      setError("Scores kunnen niet negatief zijn.");
      return;
    }

    try {
      setError(null);
      await onSubmit({
        teamOnePlayerAId: teamOnePlayerAId!,
        teamOnePlayerBId: teamOnePlayerBId!,
        teamTwoPlayerAId: teamTwoPlayerAId!,
        teamTwoPlayerBId: teamTwoPlayerBId!,
        teamOnePoints,
        teamTwoPoints,
        playedAt: playedAt ? new Date(playedAt).toISOString() : undefined,
      });

      if (!initialValues) {
        setTeamOnePlayerAId(null);
        setTeamOnePlayerBId(null);
        setTeamTwoPlayerAId(null);
        setTeamTwoPlayerBId(null);
        setTeamOnePoints(defaultPoints.teamOnePoints);
        setTeamTwoPoints(defaultPoints.teamTwoPoints);
        setPlayedAt(toDateTimeLocal(new Date()));
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Onbekende fout"
      );
    }
  };

  const swapTeams = () => {
    setTeamOnePlayerAId(teamTwoPlayerAId);
    setTeamOnePlayerBId(teamTwoPlayerBId);
    setTeamTwoPlayerAId(teamOnePlayerAId);
    setTeamTwoPlayerBId(teamOnePlayerBId);
    setTeamOnePoints(teamTwoPoints);
    setTeamTwoPoints(teamOnePoints);
  };

  const renderSelect = (
    label: string,
    value: number | null,
    onChange: (nextValue: number | null) => void
  ) => (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(Number(event.target.value) || null)}
        className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
      >
        <option value="">Kies een speler</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className={className ?? "glass-card rounded-xl p-6 space-y-5"}
    >
      {showHeader ? (
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-axoft-300">
            2v2
          </p>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-sm text-slate-400">{description}</p>
        </header>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-300">Datum & tijd</span>
        <input
          type="datetime-local"
          value={playedAt}
          onChange={(event) => setPlayedAt(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
        />
      </label>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/80">
            Team A
          </p>
          <div className="mt-3 space-y-3">
            {renderSelect("Speler 1", teamOnePlayerAId, setTeamOnePlayerAId)}
            {renderSelect("Speler 2", teamOnePlayerBId, setTeamOnePlayerBId)}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/80">
            Team B
          </p>
          <div className="mt-3 space-y-3">
            {renderSelect("Speler 3", teamTwoPlayerAId, setTeamTwoPlayerAId)}
            {renderSelect("Speler 4", teamTwoPlayerBId, setTeamTwoPlayerBId)}
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-300">Score Team A</span>
          <input
            type="number"
            value={teamOnePoints || ""}
            min={0}
            onChange={(event) =>
              setTeamOnePoints(
                event.target.value === "" ? 0 : Number(event.target.value)
              )
            }
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-300">Score Team B</span>
          <input
            type="number"
            value={teamTwoPoints || ""}
            min={0}
            onChange={(event) =>
              setTeamTwoPoints(
                event.target.value === "" ? 0 : Number(event.target.value)
              )
            }
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button
          type="button"
          onClick={swapTeams}
          className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
        >
          Wissel teams
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
            disabled={loading || players.length < 4}
            className="inline-flex items-center justify-center rounded-lg bg-axoft-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500 disabled:cursor-not-allowed disabled:bg-axoft-500/60"
          >
            {loading ? "Opslaan..." : submitLabel}
          </button>
        </div>
      </div>

      {players.length < 4 ? (
        <p className="text-sm text-amber-400">
          Voeg minimaal vier spelers toe om een 2v2-potje te registreren.
        </p>
      ) : null}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </form>
  );
}
