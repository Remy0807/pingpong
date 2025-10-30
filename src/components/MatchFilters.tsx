import { useState, type ChangeEvent } from "react";
import type { Match, PlayerStats } from "../types";

export type MatchFilters = {
  player?: number;
  season?: number;
  dateFrom?: string;
  dateTo?: string;
};

type MatchFiltersProps = {
  players: PlayerStats[];
  seasons: { id: number; name: string }[];
  filters: MatchFilters;
  onChange: (filters: MatchFilters) => void;
};

export function MatchFilters({
  players,
  seasons,
  filters,
  onChange,
}: MatchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePlayerChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onChange({
      ...filters,
      player: value ? Number(value) : undefined,
    });
  };

  const handleSeasonChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onChange({
      ...filters,
      season: value ? Number(value) : undefined,
    });
  };

  const handleDateFromChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      dateFrom: event.target.value || undefined,
    });
  };

  const handleDateToChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      dateTo: event.target.value || undefined,
    });
  };

  const clearFilters = () => {
    onChange({});
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined);

  return (
    <div className="glass-card rounded-xl">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <span className="text-xs uppercase tracking-widest text-axoft-300">
            Filters
          </span>
          {hasActiveFilters && (
            <div className="mt-1 text-sm text-slate-300">
              {[
                filters.player &&
                  `Speler: ${
                    players.find((p) => p.player.id === filters.player)?.player
                      .name
                  }`,
                filters.season &&
                  `Seizoen: ${
                    seasons.find((s) => s.id === filters.season)?.name
                  }`,
                filters.dateFrom && "Vanaf datum",
                filters.dateTo && "Tot datum",
              ]
                .filter(Boolean)
                .join(", ")}
            </div>
          )}
        </div>
        <span className="text-axoft-300">{isExpanded ? "−" : "+"}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Speler
              </label>
              <select
                value={filters.player ?? ""}
                onChange={handlePlayerChange}
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
              >
                <option value="">Alle spelers</option>
                {players.map((player) => (
                  <option key={player.player.id} value={player.player.id}>
                    {player.player.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Seizoen
              </label>
              <select
                value={filters.season ?? ""}
                onChange={handleSeasonChange}
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
              >
                <option value="">Alle seizoenen</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Vanaf datum
              </label>
              <input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={handleDateFromChange}
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Tot datum
              </label>
              <input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={handleDateToChange}
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-sm focus:border-axoft-400 focus:outline-none focus:ring-2 focus:ring-axoft-500/40 transition"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
              >
                Filters wissen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
