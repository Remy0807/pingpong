import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import SoftGate from "./components/SoftGate";
import { AppDataProvider } from "./context/AppDataContext";
import {
  getMatches,
  getPlayerStats,
  getSeasons,
  createPlayer,
  updatePlayer,
  deletePlayer,
  createMatch,
  updateMatch,
  deleteMatch,
  type MatchPayload,
} from "./lib/api";
import type { Match, PlayerStats, SeasonSummary } from "./types";
import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { MatchesPage } from "./pages/MatchesPage";
import { PlayersPage } from "./pages/PlayersPage";
import { HeadToHeadPage } from "./pages/HeadToHeadPage";

export default function App() {
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [updatingPlayer, setUpdatingPlayer] = useState(false);
  const [deletingPlayerId, setDeletingPlayerId] = useState<number | null>(null);
  const [savingMatch, setSavingMatch] = useState(false);
  const [updatingMatch, setUpdatingMatch] = useState(false);
  const [deletingMatchId, setDeletingMatchId] = useState<number | null>(null);

  const loadPlayers = useCallback(async () => {
    const playerStats = await getPlayerStats();
    setPlayers(playerStats);
  }, []);

  const loadMatches = useCallback(async () => {
    const matchList = await getMatches();
    setMatches(matchList);
  }, []);

  const loadSeasons = useCallback(async () => {
    const seasonData = await getSeasons();
    setSeasons(seasonData.seasons);
    setCurrentSeasonId(seasonData.currentSeasonId ?? null);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadPlayers(), loadMatches(), loadSeasons()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon gegevens niet laden.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadPlayers, loadMatches, loadSeasons]);

  useEffect(() => {
    refreshAll().catch((err) => {
      console.error(err);
    });
  }, [refreshAll]);

  const handlePlayerCreate = useCallback(
    async (name: string) => {
      setSavingPlayer(true);
      setError(null);
      try {
        await createPlayer({ name });
        await loadPlayers();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Kon speler niet aanmaken."
        );
        throw err;
      } finally {
        setSavingPlayer(false);
      }
    },
    [loadPlayers]
  );

  const handlePlayerUpdate = useCallback(
    async (id: number, name: string) => {
      setUpdatingPlayer(true);
      setError(null);
      try {
        await updatePlayer(id, { name });
        await loadPlayers();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Kon speler niet bijwerken."
        );
        throw err;
      } finally {
        setUpdatingPlayer(false);
      }
    },
    [loadPlayers]
  );

  const handlePlayerDelete = useCallback(
    async (id: number) => {
      setDeletingPlayerId(id);
      setError(null);
      try {
        await deletePlayer(id);
        await Promise.all([loadPlayers(), loadMatches(), loadSeasons()]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Kon speler niet verwijderen."
        );
        throw err;
      } finally {
        setDeletingPlayerId(null);
      }
    },
    [loadMatches, loadPlayers, loadSeasons]
  );

  const handleMatchCreate = useCallback(
    async (payload: MatchPayload) => {
      setSavingMatch(true);
      setError(null);
      try {
        await createMatch(payload);
        await Promise.all([loadPlayers(), loadMatches(), loadSeasons()]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Kon wedstrijd niet opslaan."
        );
        throw err;
      } finally {
        setSavingMatch(false);
      }
    },
    [loadMatches, loadPlayers, loadSeasons]
  );

  const handleMatchUpdate = useCallback(
    async (id: number, payload: MatchPayload) => {
      setUpdatingMatch(true);
      setError(null);
      try {
        await updateMatch(id, payload);
        await Promise.all([loadPlayers(), loadMatches(), loadSeasons()]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Kon wedstrijd niet bijwerken."
        );
        throw err;
      } finally {
        setUpdatingMatch(false);
      }
    },
    [loadMatches, loadPlayers, loadSeasons]
  );

  const handleMatchDelete = useCallback(
    async (id: number) => {
      setDeletingMatchId(id);
      setError(null);
      try {
        await deleteMatch(id);
        await Promise.all([loadPlayers(), loadMatches(), loadSeasons()]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Kon wedstrijd niet verwijderen."
        );
        throw err;
      } finally {
        setDeletingMatchId(null);
      }
    },
    [loadMatches, loadPlayers, loadSeasons]
  );

  const contextValue = useMemo(
    () => ({
      players,
      matches,
      seasons,
      currentSeasonId,
      loading,
      error,
      savingPlayer,
      updatingPlayer,
      deletingPlayerId,
      savingMatch,
      updatingMatch,
      deletingMatchId,
      createPlayer: handlePlayerCreate,
      updatePlayer: handlePlayerUpdate,
      deletePlayer: handlePlayerDelete,
      createMatch: handleMatchCreate,
      updateMatch: handleMatchUpdate,
      deleteMatch: handleMatchDelete,
      refreshAll,
      setError,
    }),
    [
      players,
      matches,
      seasons,
      currentSeasonId,
      loading,
      error,
      savingPlayer,
      updatingPlayer,
      deletingPlayerId,
      savingMatch,
      updatingMatch,
      deletingMatchId,
      handlePlayerCreate,
      handlePlayerUpdate,
      handlePlayerDelete,
      handleMatchCreate,
      handleMatchUpdate,
      handleMatchDelete,
      refreshAll,
    ]
  );

  return (
    <BrowserRouter>
      <SoftGate>
        <AppDataProvider value={contextValue}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="matches" element={<MatchesPage />} />
              <Route path="players" element={<PlayersPage />} />
              <Route path="head-to-head" element={<HeadToHeadPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AppDataProvider>
      </SoftGate>
    </BrowserRouter>
  );
}
