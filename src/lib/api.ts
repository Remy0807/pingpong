import type {
  DoublesMatch,
  Match,
  MatchRecommendation,
  PlayerStats,
  SeasonSummary,
} from "../types";
import { getActiveGroupId, getAuthToken } from "./sessionStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const url = input.toString().startsWith("http")
    ? input
    : `${API_BASE_URL}${input}`;

  const headers = new Headers(init?.headers ?? {});
  headers.set("Content-Type", "application/json");

  const authToken = getAuthToken();
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const groupId = getActiveGroupId();
  if (groupId) {
    headers.set("X-Group-Id", groupId);
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    const contentType = response.headers.get("content-type") ?? "";

    try {
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (typeof data === "string") {
          message = data;
        } else if (data && typeof data === "object" && "message" in data) {
          const maybeMessage = (data as { message?: unknown }).message;
          if (typeof maybeMessage === "string" && maybeMessage.trim()) {
            message = maybeMessage;
          }
        }
      } else {
        const text = await response.text();
        if (text.trim()) {
          message = text;
        }
      }
    } catch {
      // ignore parsing errors, keep default message
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type PortalGroup = {
  id: string;
  name: string;
  ownerUid: string;
  joinCodeHint?: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PortalMembership = {
  uid: string;
  groupId: string;
  role: "owner" | "member";
  joinedAt: string;
};

export type PortalUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export type PortalSession = {
  user: PortalUser;
  groups: PortalGroup[];
  memberships: PortalMembership[];
  activeGroupId: string | null;
};

export type AccountActivity = {
  id: string;
  groupId: string;
  groupName: string;
  playedAt: string;
  kind: "singles" | "doubles";
  title: string;
  detail: string;
  won: boolean;
  scored: number;
  conceded: number;
};

export type AccountMonthSummary = {
  key: string;
  label: string;
  matches: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};

export type AccountGroupSummary = {
  group: PortalGroup;
  role: "owner" | "member";
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  lastPlayedAt: string | null;
};

export type AccountOverview = {
  user: PortalUser;
  memberships: PortalMembership[];
  groups: PortalGroup[];
  totals: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
    pointsFor: number;
    pointsAgainst: number;
    groupsPlayed: number;
  };
  currentMonth: AccountMonthSummary | null;
  monthlyHistory: AccountMonthSummary[];
  recentMatches: AccountActivity[];
  groupSummaries: AccountGroupSummary[];
};

export function getPortalSession(): Promise<PortalSession> {
  return request<PortalSession>("/api/portal/session");
}

export function getAccountOverview(): Promise<AccountOverview> {
  return request<AccountOverview>("/api/account/overview");
}

export function getPortalGroups(): Promise<PortalGroup[]> {
  return request<PortalGroup[]>("/api/portal/groups");
}

export function createPortalGroup(payload: {
  name: string;
  joinCode: string;
}): Promise<{ group: PortalGroup; membership: PortalMembership }> {
  return request<{ group: PortalGroup; membership: PortalMembership }>("/api/portal/groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function joinPortalGroup(payload: {
  groupId: string;
  joinCode: string;
}): Promise<{ group: PortalGroup; membership: PortalMembership }> {
  return request<{ group: PortalGroup; membership: PortalMembership }>(`/api/portal/groups/${payload.groupId}/join`, {
    method: "POST",
    body: JSON.stringify({ joinCode: payload.joinCode }),
  });
}

export type PortalGroupMember = {
  uid: string;
  playerId?: number | null;
  email: string | null;
  displayName: string | null;
  role: "owner" | "member";
  joinedAt: string;
};

export type PortalGroupDetails = {
  group: PortalGroup & { memberCount: number };
  viewerRole: "owner" | "member";
  joinCode: string | null;
  members: PortalGroupMember[];
};

export function getPortalGroup(groupId: string): Promise<PortalGroupDetails> {
  return request<PortalGroupDetails>(`/api/portal/groups/${groupId}`);
}

export function updatePortalGroup(
  groupId: string,
  payload: { name?: string; joinCode?: string }
): Promise<{ group: PortalGroup & { memberCount: number } }> {
  return request<{ group: PortalGroup & { memberCount: number } }>(
    `/api/portal/groups/${groupId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export function deletePortalGroup(groupId: string) {
  return request<void>(`/api/portal/groups/${groupId}`, {
    method: "DELETE",
  });
}

export function removePortalGroupMember(groupId: string, uid: string) {
  return request<void>(`/api/portal/groups/${groupId}/members/${uid}`, {
    method: "DELETE",
  });
}

export function leavePortalGroup(groupId: string) {
  return request<void>(`/api/portal/groups/${groupId}/membership`, {
    method: "DELETE",
  });
}

export function getPlayerStats(): Promise<PlayerStats[]> {
  return request<PlayerStats[]>("/api/players");
}

export function createPlayer(payload: { name: string }) {
  return request<PlayerStats>("/api/players", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePlayer(id: number, payload: { name: string }) {
  return request<PlayerStats>(`/api/players/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePlayer(id: number) {
  return request<void>(`/api/players/${id}`, {
    method: "DELETE",
  });
}

export function getMatches(): Promise<Match[]> {
  return request<Match[]>("/api/matches");
}

export type MatchPayload = {
  playerOneId: number;
  playerTwoId: number;
  playerOnePoints: number;
  playerTwoPoints: number;
  playedAt?: string;
};

export function createMatch(payload: MatchPayload) {
  return request<Match>("/api/matches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createMatches(payloads: MatchPayload[]) {
  const matches: Match[] = [];

  for (const payload of payloads) {
    matches.push(await createMatch(payload));
  }

  return matches;
}

export function updateMatch(id: number, payload: MatchPayload) {
  return request<Match>(`/api/matches/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteMatch(id: number) {
  return request<void>(`/api/matches/${id}`, {
    method: "DELETE",
  });
}

export type DoublesMatchPayload = {
  teamOnePlayerAId: number;
  teamOnePlayerBId: number;
  teamTwoPlayerAId: number;
  teamTwoPlayerBId: number;
  teamOnePoints: number;
  teamTwoPoints: number;
  playedAt?: string;
};

export function getDoublesMatches(): Promise<DoublesMatch[]> {
  return request<DoublesMatch[]>("/api/doubles-matches");
}

export function createDoublesMatch(payload: DoublesMatchPayload) {
  return request<DoublesMatch>("/api/doubles-matches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDoublesMatch(id: number, payload: DoublesMatchPayload) {
  return request<DoublesMatch>(`/api/doubles-matches/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteDoublesMatch(id: number) {
  return request<void>(`/api/doubles-matches/${id}`, {
    method: "DELETE",
  });
}

export type SeasonsResponse = {
  currentSeasonId: number;
  seasons: SeasonSummary[];
};

export function getSeasons(): Promise<SeasonsResponse> {
  return request<SeasonsResponse>("/api/seasons");
}

export type RecommendationsResponse = {
  generatedAt: string;
  season: {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
  };
  recommendations: MatchRecommendation[];
};

export function getMatchRecommendations(): Promise<RecommendationsResponse> {
  return request<RecommendationsResponse>("/api/recommendations");
}
