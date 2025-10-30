import { createContext, useContext } from "react";
import type { Match, PlayerStats, SeasonSummary } from "../types";
import type { MatchPayload } from "../lib/api";

export type AppDataContextValue = {
  players: PlayerStats[];
  matches: Match[];
  seasons: SeasonSummary[];
  currentSeasonId: number | null;
  // Currently selected game code (from landing page). Uppercased.
  currentGameCode: string | null;
  loading: boolean;
  error: string | null;
  savingPlayer: boolean;
  savingMatch: boolean;
  updatingMatch: boolean;
  deletingMatchId: number | null;
  updatingPlayer: boolean;
  deletingPlayerId: number | null;
  createPlayer: (name: string) => Promise<void>;
  updatePlayer: (id: number, name: string) => Promise<void>;
  deletePlayer: (id: number) => Promise<void>;
  createMatch: (payload: MatchPayload) => Promise<void>;
  updateMatch: (id: number, payload: MatchPayload) => Promise<void>;
  deleteMatch: (id: number) => Promise<void>;
  refreshAll: () => Promise<void>;
  setError: (message: string | null) => void;
  // Set or clear the current game code. Pass null to clear.
  setCurrentGameCode: (code: string | null) => void;
};

const AppDataContext = createContext<AppDataContextValue | undefined>(
  undefined
);

export function AppDataProvider({
  value,
  children,
}: {
  value: AppDataContextValue;
  children: React.ReactNode;
}) {
  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return context;
}
