import type { Match, PlayerStats, SeasonSummary } from "../types";

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
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
