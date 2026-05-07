import { useEffect, useMemo, useState } from "react";
import type { PlayerStats } from "../types";

export type MatchFormValues = {
  playerOneId: number;
  playerTwoId: number;
  playerOnePoints: number;
  playerTwoPoints: number;
  playedAt?: string;
};

type ScoreRow = {
  id: number;
  playerOnePoints: number;
  playerTwoPoints: number;
};

type ScorePreset = {
  label: string;
  playerOnePoints: number;
  playerTwoPoints: number;
};

type BaseMatchFormProps = {
  players: PlayerStats[];
  playerOptions?: Array<{
    value: number;
    label: string;
  }>;
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

type SingleMatchFormProps = BaseMatchFormProps & {
  allowMultiple?: false;
  onSubmit: (match: MatchFormValues) => Promise<void> | void;
};

type MultiMatchFormProps = BaseMatchFormProps & {
  allowMultiple: true;
  onSubmit: (matches: MatchFormValues[]) => Promise<void> | void;
};

type MatchFormProps = SingleMatchFormProps | MultiMatchFormProps;

const defaultPoints = { playerOnePoints: 11, playerTwoPoints: 7 };
const scorePresets: ScorePreset[] = [
  { label: "11-9", playerOnePoints: 11, playerTwoPoints: 9 },
  { label: "12-10", playerOnePoints: 12, playerTwoPoints: 10 },
  { label: "15-13", playerOnePoints: 15, playerTwoPoints: 13 },
  { label: "18-16", playerOnePoints: 18, playerTwoPoints: 16 },
];

const isValidSinglesScore = (playerOnePoints: number, playerTwoPoints: number) => {
  if (playerOnePoints === playerTwoPoints) {
    return false;
  }

  const winnerScore = Math.max(playerOnePoints, playerTwoPoints);
  const loserScore = Math.min(playerOnePoints, playerTwoPoints);
  return winnerScore >= 11 && winnerScore - loserScore >= 2;
};

const createScoreRow = (id: number): ScoreRow => ({
  id,
  ...defaultPoints,
});

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
  playerOptions: providedPlayerOptions,
  onSubmit,
  loading,
  submitLabel = "Resultaat opslaan",
  title = "Nieuw potje registreren",
  description = "Noteer de winnaar en het aantal punten. De standen worden automatisch bijgewerkt.",
  showHeader = true,
  headerBadge = "Resultaat",
  initialValues,
  onCancel,
  className,
  allowMultiple = false,
}: MatchFormProps) {
  const [playerOneId, setPlayerOneId] = useState<number | null>(
    initialValues?.playerOneId ?? null
  );
  const [playerTwoId, setPlayerTwoId] = useState<number | null>(
    initialValues?.playerTwoId ?? null
  );
  const [playerOnePoints, setPlayerOnePoints] = useState(
    initialValues?.playerOnePoints ?? defaultPoints.playerOnePoints
  );
  const [playerTwoPoints, setPlayerTwoPoints] = useState(
    initialValues?.playerTwoPoints ?? defaultPoints.playerTwoPoints
  );
  const [playedAt, setPlayedAt] = useState<string>(
    toDateTimeLocal(initialValues?.playedAt ?? new Date())
  );
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>([
    createScoreRow(1),
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialValues) {
      return;
    }
    setPlayerOneId(initialValues.playerOneId);
    setPlayerTwoId(initialValues.playerTwoId);
    setPlayerOnePoints(initialValues.playerOnePoints);
    setPlayerTwoPoints(initialValues.playerTwoPoints);
    setScoreRows([
      {
        id: 1,
        playerOnePoints: initialValues.playerOnePoints,
        playerTwoPoints: initialValues.playerTwoPoints,
      },
    ]);
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
      providedPlayerOptions?.filter((option) => Number.isFinite(option.value)) ??
      players.map((stats) => ({
        value: stats.player.id,
        label: stats.player.name,
      })),
    [providedPlayerOptions, players]
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

    const batchBasePlayedAt = playedAt ? new Date(playedAt) : undefined;
    const matches = allowMultiple
      ? scoreRows.map((row, index) => ({
          playerOneId,
          playerTwoId,
          playerOnePoints: row.playerOnePoints,
          playerTwoPoints: row.playerTwoPoints,
          playedAt: batchBasePlayedAt
            ? new Date(batchBasePlayedAt.getTime() + index * 1000).toISOString()
            : undefined,
        }))
      : [
          {
            playerOneId,
            playerTwoId,
            playerOnePoints,
            playerTwoPoints,
            playedAt: playedAt ? new Date(playedAt).toISOString() : undefined,
          },
        ];

    if (matches.some((match) => !isValidSinglesScore(match.playerOnePoints, match.playerTwoPoints))) {
      setError("Een 1v1-potje moet minstens 11 punten halen en met 2 punten verschil gewonnen worden.");
      return;
    }

    if (
      matches.some(
        (match) => match.playerOnePoints < 0 || match.playerTwoPoints < 0
      )
    ) {
      setError("Scores kunnen niet negatief zijn.");
      return;
    }

    try {
      setError(null);
      if (allowMultiple) {
        await onSubmit(matches);
      } else {
        await onSubmit(matches[0]);
      }

      if (!initialValues) {
        setPlayerOneId(null);
        setPlayerTwoId(null);
        setPlayerOnePoints(defaultPoints.playerOnePoints);
        setPlayerTwoPoints(defaultPoints.playerTwoPoints);
        setScoreRows([createScoreRow(1)]);
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
    setScoreRows((rows) =>
      rows.map((row) => ({
        ...row,
        playerOnePoints: row.playerTwoPoints,
        playerTwoPoints: row.playerOnePoints,
      }))
    );
  };

  const updateScoreRow = (
    id: number,
    field: "playerOnePoints" | "playerTwoPoints",
    value: number
  ) => {
    setScoreRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const addScoreRow = () => {
    setScoreRows((rows) => [
      ...rows,
      createScoreRow(Math.max(...rows.map((row) => row.id)) + 1),
    ]);
  };

  const moveScoreRow = (id: number, direction: "up" | "down") => {
    setScoreRows((rows) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) {
        return rows;
      }
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= rows.length) {
        return rows;
      }

      const nextRows = [...rows];
      [nextRows[index], nextRows[targetIndex]] = [nextRows[targetIndex], nextRows[index]];
      return nextRows;
    });
  };

  const removeScoreRow = (id: number) => {
    setScoreRows((rows) =>
      rows.length === 1 ? rows : rows.filter((row) => row.id !== id)
    );
  };

  const submitText =
    loading && allowMultiple
      ? "Opslaan..."
      : allowMultiple
        ? `${scoreRows.length} ${scoreRows.length === 1 ? "potje" : "potjes"} opslaan`
      : submitLabel;

  const renderScorePresets = (
    applyPreset: (playerOnePoints: number, playerTwoPoints: number) => void,
    compact = false
  ) => (
    <div className={`flex flex-wrap gap-2 ${compact ? "pt-1" : ""}`}>
      <span className="mr-1 text-[11px] uppercase tracking-[0.25em] text-slate-500">
        Snel
      </span>
      {scorePresets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => applyPreset(preset.playerOnePoints, preset.playerTwoPoints)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-axoft-400 hover:text-white"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );

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
          {description ? (
            <p className="text-sm text-slate-400">{description}</p>
          ) : null}
        </header>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">
          Datum &amp; tijd
        </label>
        <input
          type="datetime-local"
          value={playedAt}
          onChange={(event) => setPlayedAt(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
        />
        <p className="text-xs text-slate-500">
          Een 1v1-potje moet minstens 11 punten halen en met 2 punten verschil gewonnen worden.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Speler A
          </label>
          <select
            value={playerOneId ?? ""}
            onChange={(event) =>
              setPlayerOneId(Number(event.target.value) || null)
            }
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
          <label className="block text-sm font-medium text-slate-300">
            Speler B
          </label>
          <select
            value={playerTwoId ?? ""}
            onChange={(event) =>
              setPlayerTwoId(Number(event.target.value) || null)
            }
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

      {allowMultiple ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-slate-300">
              Potjes tegen dezelfde tegenstander
            </label>
            <button
              type="button"
              onClick={addScoreRow}
              className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
            >
              + Potje
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Zet de potjes in speelvolgorde. Bovenaan is eerst, onderaan is laatst.
            Dat bepaalt ook de Elo-volgorde.
          </p>
          <div className="space-y-2">
            {scoreRows.map((row, index) => (
              <div
                key={row.id}
                className="rounded-lg border border-white/10 bg-slate-950/30 p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-axoft-200/80">
                    #{index + 1} volgorde
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveScoreRow(row.id, "up")}
                      disabled={index === 0}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-sm font-semibold text-slate-300 transition hover:border-axoft-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Potje ${index + 1} omhoog`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveScoreRow(row.id, "down")}
                      disabled={index === scoreRows.length - 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-sm font-semibold text-slate-300 transition hover:border-axoft-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Potje ${index + 1} omlaag`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeScoreRow(row.id)}
                      disabled={scoreRows.length === 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-sm font-semibold text-slate-300 transition hover:border-rose-400 hover:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Potje ${index + 1} verwijderen`}
                    >
                      X
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-400">
                      Speler A
                    </label>
                    <input
                      type="number"
                      value={row.playerOnePoints || ""}
                      min={0}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateScoreRow(
                          row.id,
                          "playerOnePoints",
                          value === "" ? 0 : Number(value)
                        );
                      }}
                      className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-400">
                      Speler B
                    </label>
                    <input
                      type="number"
                      value={row.playerTwoPoints || ""}
                      min={0}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateScoreRow(
                          row.id,
                          "playerTwoPoints",
                          value === "" ? 0 : Number(value)
                        );
                      }}
                      className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Score speler A
            </label>
            <input
              type="number"
              value={playerOnePoints || ""}
              min={0}
              onChange={(event) => {
                const value = event.target.value;
                setPlayerOnePoints(value === "" ? 0 : Number(value));
              }}
              className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Score speler B
            </label>
            <input
              type="number"
              value={playerTwoPoints || ""}
              min={0}
              onChange={(event) => {
                const value = event.target.value;
                setPlayerTwoPoints(value === "" ? 0 : Number(value));
              }}
              className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
            />
          </div>
        </div>
      )}

      {!allowMultiple ? (
        <div className="rounded-lg border border-white/10 bg-slate-950/30 p-3">
          {renderScorePresets((nextPlayerOnePoints, nextPlayerTwoPoints) => {
            setPlayerOnePoints(nextPlayerOnePoints);
            setPlayerTwoPoints(nextPlayerTwoPoints);
          })}
        </div>
      ) : null}

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
            disabled={loading || playerOptions.length < 2}
            className="inline-flex items-center justify-center rounded-lg bg-axoft-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500 disabled:cursor-not-allowed disabled:bg-axoft-500/60"
          >
            {loading ? "Opslaan..." : submitText}
          </button>
        </div>
      </div>

      {playerOptions.length < 2 ? (
        <p className="text-sm text-amber-400">
          Voeg minimaal twee spelers toe om een potje te registreren.
        </p>
      ) : null}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </form>
  );
}
