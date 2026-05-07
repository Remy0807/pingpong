import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import SoftGate from "./components/SoftGate";
import { AppDataProvider } from "./context/AppDataContext";
import {
  createDoublesMatch,
  getAccountOverview,
  getPortalGroup,
  getMatches,
  getDoublesMatches,
  getPlayerStats,
  getSeasons,
  createPlayer,
  updatePlayer,
  deletePlayer,
  createMatch,
  createMatches,
  deleteDoublesMatch,
  updateMatch,
  deleteMatch,
  updateDoublesMatch,
  type AccountOverview,
  type DoublesMatchPayload,
  type MatchPayload,
  type PortalGroupMember,
} from "./lib/api";
import type { DoublesMatch, Match, PlayerStats, SeasonSummary } from "./types";
import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { MatchesPage } from "./pages/MatchesPage";
import { MembersPage } from "./pages/MembersPage";
import { PlayersPage } from "./pages/PlayersPage";
import { HeadToHeadPage } from "./pages/HeadToHeadPage";
import { RecommendationsPage } from "./pages/RecommendationsPage";
import { PlayerProfilePage } from "./pages/PlayerProfilePage";
import { EloSimulatorPage } from "./pages/EloSimulatorPage";
import { WallOfShamePage } from "./pages/WallOfShamePage";
import { RivalryPage } from "./pages/RivalryPage";
import { DoublesPage } from "./pages/DoublesPage";
import { usePortal } from "./context/PortalContext";

function PortalAwareApp() {
  const { portalMode, activeGroupId } = usePortal();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [doublesMatches, setDoublesMatches] = useState<DoublesMatch[]>([]);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(null);
  const [accountOverview, setAccountOverview] = useState<AccountOverview | null>(null);
  const [groupMembers, setGroupMembers] = useState<PortalGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [updatingPlayer, setUpdatingPlayer] = useState(false);
  const [deletingPlayerId, setDeletingPlayerId] = useState<number | null>(null);
  const [savingMatch, setSavingMatch] = useState(false);
  const [updatingMatch, setUpdatingMatch] = useState(false);
  const [deletingMatchId, setDeletingMatchId] = useState<number | null>(null);
  const [savingDoublesMatch, setSavingDoublesMatch] = useState(false);
  const [updatingDoublesMatch, setUpdatingDoublesMatch] = useState(false);
  const [deletingDoublesMatchId, setDeletingDoublesMatchId] = useState<number | null>(null);

  const loadPlayers = useCallback(async () => {
    const playerStats = await getPlayerStats();
    setPlayers(playerStats);
  }, []);

  const loadMatches = useCallback(async () => {
    const matchList = await getMatches();
    setMatches(matchList);
  }, []);

  const loadDoublesMatches = useCallback(async () => {
    const matchList = await getDoublesMatches();
    setDoublesMatches(matchList);
  }, []);

  const loadSeasons = useCallback(async () => {
    const seasonData = await getSeasons();
    setSeasons(seasonData.seasons);
    setCurrentSeasonId(seasonData.currentSeasonId ?? null);
  }, []);

  const loadOverview = useCallback(async () => {
    const overview = await getAccountOverview();
    setAccountOverview(overview);
  }, []);

  const loadGroupMembers = useCallback(async (groupId: string) => {
    const details = await getPortalGroup(groupId);
    setGroupMembers(details.members);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadPlayers(),
        loadMatches(),
        loadDoublesMatches(),
        loadSeasons(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon gegevens niet laden.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadPlayers, loadMatches, loadDoublesMatches, loadSeasons]);

  useEffect(() => {
    if (portalMode !== "app") {
      setLoading(false);
      setError(null);
      setPlayers([]);
      setMatches([]);
      setDoublesMatches([]);
      setSeasons([]);
      setCurrentSeasonId(null);
      setAccountOverview(null);
      setGroupMembers([]);
      return;
    }

    if (!activeGroupId) {
      setPlayers([]);
      setMatches([]);
      setDoublesMatches([]);
      setSeasons([]);
      setCurrentSeasonId(null);
      setGroupMembers([]);
      setLoading(true);
      setError(null);
      loadOverview()
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Kon overzicht niet laden.");
          console.error(err);
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }

    setAccountOverview(null);
    loadGroupMembers(activeGroupId).catch((err) => {
      console.error(err);
    });
    refreshAll().catch((err) => {
      console.error(err);
    });
  }, [activeGroupId, loadGroupMembers, loadOverview, portalMode, refreshAll]);

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
        await Promise.all([
          loadPlayers(),
          loadMatches(),
          loadDoublesMatches(),
          loadSeasons(),
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Kon speler niet verwijderen."
        );
        throw err;
      } finally {
        setDeletingPlayerId(null);
      }
    },
    [loadDoublesMatches, loadMatches, loadPlayers, loadSeasons]
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

  const handleMatchesCreate = useCallback(
    async (payloads: MatchPayload[]) => {
      if (!payloads.length) {
        return;
      }

      setSavingMatch(true);
      setError(null);
      try {
        await createMatches(payloads);
        await Promise.all([loadPlayers(), loadMatches(), loadSeasons()]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Kon wedstrijden niet opslaan."
        );
        throw err;
      } finally {
        setSavingMatch(false);
      }
    },
    [loadMatches, loadPlayers, loadSeasons]
  );

  const handleDoublesMatchCreate = useCallback(
    async (payload: DoublesMatchPayload) => {
      setSavingDoublesMatch(true);
      setError(null);
      try {
        await createDoublesMatch(payload);
        await Promise.all([loadDoublesMatches(), loadSeasons()]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Kon 2v2-wedstrijd niet opslaan."
        );
        throw err;
      } finally {
        setSavingDoublesMatch(false);
      }
    },
    [loadDoublesMatches, loadSeasons]
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

  const handleDoublesMatchUpdate = useCallback(
    async (id: number, payload: DoublesMatchPayload) => {
      setUpdatingDoublesMatch(true);
      setError(null);
      try {
        await updateDoublesMatch(id, payload);
        await Promise.all([loadDoublesMatches(), loadSeasons()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Kon 2v2-wedstrijd niet bijwerken."
        );
        throw err;
      } finally {
        setUpdatingDoublesMatch(false);
      }
    },
    [loadDoublesMatches, loadSeasons]
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

  const handleDoublesMatchDelete = useCallback(
    async (id: number) => {
      setDeletingDoublesMatchId(id);
      setError(null);
      try {
        await deleteDoublesMatch(id);
        await Promise.all([loadDoublesMatches(), loadSeasons()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Kon 2v2-wedstrijd niet verwijderen."
        );
        throw err;
      } finally {
        setDeletingDoublesMatchId(null);
      }
    },
    [loadDoublesMatches, loadSeasons]
  );

  const contextValue = useMemo(
    () => ({
      players,
      matches,
      doublesMatches,
      seasons,
      currentSeasonId,
      accountOverview,
      groupMembers,
      loading,
      error,
      savingPlayer,
      updatingPlayer,
      deletingPlayerId,
      savingMatch,
      updatingMatch,
      deletingMatchId,
      savingDoublesMatch,
      updatingDoublesMatch,
      deletingDoublesMatchId,
      createPlayer: handlePlayerCreate,
      updatePlayer: handlePlayerUpdate,
      deletePlayer: handlePlayerDelete,
      createMatch: handleMatchCreate,
      createMatches: handleMatchesCreate,
      updateMatch: handleMatchUpdate,
      deleteMatch: handleMatchDelete,
      createDoublesMatch: handleDoublesMatchCreate,
      updateDoublesMatch: handleDoublesMatchUpdate,
      deleteDoublesMatch: handleDoublesMatchDelete,
      refreshAll,
      setError,
    }),
    [
      players,
      matches,
      doublesMatches,
      seasons,
      currentSeasonId,
      accountOverview,
      groupMembers,
      loading,
      error,
      savingPlayer,
      updatingPlayer,
      deletingPlayerId,
      savingMatch,
      updatingMatch,
      deletingMatchId,
      savingDoublesMatch,
      updatingDoublesMatch,
      deletingDoublesMatchId,
      handlePlayerCreate,
      handlePlayerUpdate,
      handlePlayerDelete,
      handleMatchCreate,
      handleMatchesCreate,
      handleMatchUpdate,
      handleMatchDelete,
      handleDoublesMatchCreate,
      handleDoublesMatchUpdate,
      handleDoublesMatchDelete,
      refreshAll,
    ]
  );

  return (
    <AppDataProvider value={contextValue}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="matches" element={<MatchesPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="doubles" element={<DoublesPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="players/:id" element={<PlayerProfilePage />} />
          <Route path="head-to-head" element={<HeadToHeadPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="elo-simulator" element={<EloSimulatorPage />} />
          <Route path="wall-of-shame" element={<WallOfShamePage />} />
          <Route path="rivalries/:playerAId/:playerBId" element={<RivalryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppDataProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SoftGate>
        <PortalAwareApp />
      </SoftGate>
    </BrowserRouter>
  );
}
