import { createContext, useContext } from "react";
import type { DoublesMatch, Match, PlayerStats, SeasonSummary } from "../types";
import type { DoublesMatchPayload, MatchPayload } from "../lib/api";

export type AppDataContextValue = {
  players: PlayerStats[];
  matches: Match[];
  doublesMatches: DoublesMatch[];
  seasons: SeasonSummary[];
  currentSeasonId: number | null;
  loading: boolean;
  error: string | null;
  savingPlayer: boolean;
  savingMatch: boolean;
  savingDoublesMatch: boolean;
  updatingMatch: boolean;
  updatingDoublesMatch: boolean;
  deletingMatchId: number | null;
  deletingDoublesMatchId: number | null;
  updatingPlayer: boolean;
  deletingPlayerId: number | null;
  createPlayer: (name: string) => Promise<void>;
  updatePlayer: (id: number, name: string) => Promise<void>;
  deletePlayer: (id: number) => Promise<void>;
  createMatch: (payload: MatchPayload) => Promise<void>;
  updateMatch: (id: number, payload: MatchPayload) => Promise<void>;
  deleteMatch: (id: number) => Promise<void>;
  createDoublesMatch: (payload: DoublesMatchPayload) => Promise<void>;
  updateDoublesMatch: (id: number, payload: DoublesMatchPayload) => Promise<void>;
  deleteDoublesMatch: (id: number) => Promise<void>;
  refreshAll: () => Promise<void>;
  setError: (message: string | null) => void;
};

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export function AppDataProvider({
  value,
  children
}: {
  value: AppDataContextValue;
  children: React.ReactNode;
}) {
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return context;
}
