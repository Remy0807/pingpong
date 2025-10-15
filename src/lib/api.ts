import type {
  AuthResponse,
  AuthUser,
  FriendEntry,
  FriendsResponse,
  GroupInviteEntry,
  GroupInvitesResponse,
  GroupSummary,
  GroupsResponse,
  Match,
  PlayerStats,
  SeasonSummary
} from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

const resolveInput = (input: RequestInfo): RequestInfo => {
  if (typeof input === "string" && input.startsWith("/") && API_BASE_URL) {
    return `${API_BASE_URL}${input}`;
  }
  return input;
};

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);

  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(resolveInput(input), {
    ...init,
    headers
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

export function getPlayerStats(): Promise<PlayerStats[]> {
  return request<PlayerStats[]>("/api/players");
}

export function createPlayer(payload: { name: string }) {
  return request<PlayerStats>("/api/players", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updatePlayer(id: number, payload: { name: string }) {
  return request<PlayerStats>(`/api/players/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deletePlayer(id: number) {
  return request<void>(`/api/players/${id}`, {
    method: "DELETE"
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
    body: JSON.stringify(payload)
  });
}

export function updateMatch(id: number, payload: MatchPayload) {
  return request<Match>(`/api/matches/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteMatch(id: number) {
  return request<void>(`/api/matches/${id}`, {
    method: "DELETE"
  });
}

export type SeasonsResponse = {
  currentSeasonId: number;
  seasons: SeasonSummary[];
};

export function getSeasons(): Promise<SeasonsResponse> {
  return request<SeasonsResponse>("/api/seasons");
}

export function registerUser(payload: { username: string; email?: string; password: string }) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function loginUser(payload: { username?: string; email?: string; password: string }) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getCurrentUser() {
  return request<{ user: AuthUser }>("/auth/me");
}

export function getFriends() {
  return request<FriendsResponse>("/api/friends");
}

export function sendFriendRequest(payload: { userId?: number; username?: string }) {
  return request<{ friendship: FriendEntry }>("/api/friends/request", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function respondFriendRequest(payload: {
  friendshipId: number;
  action: "accept" | "decline" | "cancel";
}) {
  return request<{ friendship: FriendEntry } | void>("/api/friends/respond", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getGroups() {
  return request<GroupsResponse>("/api/groups");
}

export function createGroup(payload: { name: string }) {
  return request<{ group: GroupSummary }>("/api/groups", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getGroupInvites() {
  return request<GroupInvitesResponse>("/api/groups/invites");
}

export function inviteToGroup(groupId: number, payload: { userId?: number; username?: string }) {
  return request<{ invite: GroupInviteEntry }>(`/api/groups/${groupId}/invite`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function respondToGroupInvite(inviteId: number, action: "accept" | "decline" | "cancel") {
  return request<{ invite: GroupInviteEntry } | void>(
    `/api/groups/invites/${inviteId}/respond`,
    {
      method: "POST",
      body: JSON.stringify({ action })
    }
  );
}
