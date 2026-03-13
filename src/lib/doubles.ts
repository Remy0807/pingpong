import type { DoublesMatch, Player } from "../types";

export const DOUBLES_ELO_BASE_RATING = 1000;
const DOUBLES_ELO_K = 32;

export type DoublesPlayerLeaderboardEntry = {
  player: Pick<Player, "id" | "name">;
  wins: number;
  losses: number;
  matches: number;
  pointsFor: number;
  pointsAgainst: number;
  winRate: number;
  pointDifferential: number;
  rating: number;
  ratingTrend: number[];
};

export type DoublesTeamLeaderboardEntry = {
  id: string;
  players: [Pick<Player, "id" | "name">, Pick<Player, "id" | "name">];
  label: string;
  wins: number;
  losses: number;
  matches: number;
  pointsFor: number;
  pointsAgainst: number;
  winRate: number;
  pointDifferential: number;
  rating: number;
};

export type DoublesSummary = {
  matches: number;
  activePlayers: number;
  activeTeams: number;
};

export type DoublesMatchEloBreakdown = {
  teamOneRatingBefore: number;
  teamTwoRatingBefore: number;
  teamOneDelta: number;
  teamTwoDelta: number;
};

export type DoublesEloSnapshot = {
  playerRatings: Map<number, number>;
  ratingTrends: Map<number, number[]>;
  matchBreakdowns: Map<number, DoublesMatchEloBreakdown>;
};

export function getDoublesTeamLabel(
  players: Array<Pick<Player, "name">>
): string {
  return players.map((player) => player.name).join(" & ");
}

export function filterDoublesMatchesByScope(
  matches: DoublesMatch[],
  scope: "overall" | number
) {
  if (scope === "overall") {
    return matches;
  }

  return matches.filter((match) => match.season?.id === scope);
}

export function calculateDoublesEloSnapshot(
  matches: DoublesMatch[]
): DoublesEloSnapshot {
  const playerRatings = new Map<number, number>();
  const ratingTrends = new Map<number, number[]>();
  const matchBreakdowns = new Map<number, DoublesMatchEloBreakdown>();

  const ensurePlayer = (player: Pick<Player, "id" | "name">) => {
    if (!playerRatings.has(player.id)) {
      playerRatings.set(player.id, DOUBLES_ELO_BASE_RATING);
      ratingTrends.set(player.id, [DOUBLES_ELO_BASE_RATING]);
    }
  };

  const sortedMatches = [...matches].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
  );

  sortedMatches.forEach((match) => {
    const teamOnePlayers = match.teamOnePlayers;
    const teamTwoPlayers = match.teamTwoPlayers;

    [...teamOnePlayers, ...teamTwoPlayers].forEach(ensurePlayer);

    const teamOneRatingBeforeRaw =
      teamOnePlayers.reduce(
        (total, player) => total + (playerRatings.get(player.id) ?? DOUBLES_ELO_BASE_RATING),
        0
      ) / teamOnePlayers.length;
    const teamTwoRatingBeforeRaw =
      teamTwoPlayers.reduce(
        (total, player) => total + (playerRatings.get(player.id) ?? DOUBLES_ELO_BASE_RATING),
        0
      ) / teamTwoPlayers.length;
    const teamOneRatingBefore = Math.round(teamOneRatingBeforeRaw);
    const teamTwoRatingBefore = Math.round(teamTwoRatingBeforeRaw);

    const expectedTeamOne =
      1 / (1 + 10 ** ((teamTwoRatingBeforeRaw - teamOneRatingBeforeRaw) / 400));
    const scoreTeamOne = match.winnerTeam === 1 ? 1 : 0;
    const teamOneDelta = Math.round(
      DOUBLES_ELO_K * (scoreTeamOne - expectedTeamOne)
    );
    const teamTwoDelta = -teamOneDelta;

    teamOnePlayers.forEach((player) => {
      const nextRating =
        (playerRatings.get(player.id) ?? DOUBLES_ELO_BASE_RATING) + teamOneDelta;
      playerRatings.set(player.id, nextRating);
      ratingTrends.get(player.id)?.push(nextRating);
    });

    teamTwoPlayers.forEach((player) => {
      const nextRating =
        (playerRatings.get(player.id) ?? DOUBLES_ELO_BASE_RATING) + teamTwoDelta;
      playerRatings.set(player.id, nextRating);
      ratingTrends.get(player.id)?.push(nextRating);
    });

    matchBreakdowns.set(match.id, {
      teamOneRatingBefore,
      teamTwoRatingBefore,
      teamOneDelta,
      teamTwoDelta,
    });
  });

  return {
    playerRatings,
    ratingTrends,
    matchBreakdowns,
  };
}

export function buildDoublesPlayerLeaderboard(
  matches: DoublesMatch[],
  snapshot = calculateDoublesEloSnapshot(matches)
): DoublesPlayerLeaderboardEntry[] {
  const map = new Map<number, DoublesPlayerLeaderboardEntry>();

  const ensurePlayer = (player: Pick<Player, "id" | "name">) => {
    const existing = map.get(player.id);
    if (existing) {
      return existing;
    }

    const created: DoublesPlayerLeaderboardEntry = {
      player,
      wins: 0,
      losses: 0,
      matches: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      winRate: 0,
      pointDifferential: 0,
      rating: snapshot.playerRatings.get(player.id) ?? DOUBLES_ELO_BASE_RATING,
      ratingTrend:
        snapshot.ratingTrends.get(player.id) ?? [DOUBLES_ELO_BASE_RATING],
    };
    map.set(player.id, created);
    return created;
  };

  matches.forEach((match) => {
    const teamOneWon = match.winnerTeam === 1;
    const teamOnePlayers = match.teamOnePlayers;
    const teamTwoPlayers = match.teamTwoPlayers;

    teamOnePlayers.forEach((player) => {
      const entry = ensurePlayer(player);
      entry.matches += 1;
      entry.pointsFor += match.teamOnePoints;
      entry.pointsAgainst += match.teamTwoPoints;
      if (teamOneWon) {
        entry.wins += 1;
      } else {
        entry.losses += 1;
      }
    });

    teamTwoPlayers.forEach((player) => {
      const entry = ensurePlayer(player);
      entry.matches += 1;
      entry.pointsFor += match.teamTwoPoints;
      entry.pointsAgainst += match.teamOnePoints;
      if (teamOneWon) {
        entry.losses += 1;
      } else {
        entry.wins += 1;
      }
    });
  });

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      winRate: entry.matches ? entry.wins / entry.matches : 0,
      pointDifferential: entry.pointsFor - entry.pointsAgainst,
      rating: snapshot.playerRatings.get(entry.player.id) ?? entry.rating,
      ratingTrend: snapshot.ratingTrends.get(entry.player.id) ?? entry.ratingTrend,
    }))
    .sort((a, b) => {
      if (b.rating === a.rating) {
        if (b.pointDifferential === a.pointDifferential) {
          return b.matches - a.matches;
        }
        return b.pointDifferential - a.pointDifferential;
      }
      return b.rating - a.rating;
    });
}

export function buildDoublesTeamLeaderboard(
  matches: DoublesMatch[],
  snapshot = calculateDoublesEloSnapshot(matches)
): DoublesTeamLeaderboardEntry[] {
  const map = new Map<string, DoublesTeamLeaderboardEntry>();

  const buildKey = (team: [Pick<Player, "id" | "name">, Pick<Player, "id" | "name">]) =>
    [...team]
      .sort((left, right) => left.id - right.id)
      .map((player) => player.id)
      .join("-");

  const ensureTeam = (
    team: [Pick<Player, "id" | "name">, Pick<Player, "id" | "name">]
  ) => {
    const sortedTeam = [...team].sort((left, right) => left.id - right.id) as [
      Pick<Player, "id" | "name">,
      Pick<Player, "id" | "name">,
    ];
    const key = buildKey(sortedTeam);
    const existing = map.get(key);
    if (existing) {
      return existing;
    }

    const created: DoublesTeamLeaderboardEntry = {
      id: key,
      players: sortedTeam,
      label: getDoublesTeamLabel(sortedTeam),
      wins: 0,
      losses: 0,
      matches: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      winRate: 0,
      pointDifferential: 0,
      rating: Math.round(
        sortedTeam.reduce(
          (total, player) =>
            total +
            (snapshot.playerRatings.get(player.id) ?? DOUBLES_ELO_BASE_RATING),
          0
        ) / sortedTeam.length
      ),
    };
    map.set(key, created);
    return created;
  };

  matches.forEach((match) => {
    const teamOne = ensureTeam(match.teamOnePlayers);
    const teamTwo = ensureTeam(match.teamTwoPlayers);
    const teamOneWon = match.winnerTeam === 1;

    teamOne.matches += 1;
    teamTwo.matches += 1;
    teamOne.pointsFor += match.teamOnePoints;
    teamOne.pointsAgainst += match.teamTwoPoints;
    teamTwo.pointsFor += match.teamTwoPoints;
    teamTwo.pointsAgainst += match.teamOnePoints;

    if (teamOneWon) {
      teamOne.wins += 1;
      teamTwo.losses += 1;
    } else {
      teamTwo.wins += 1;
      teamOne.losses += 1;
    }
  });

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      winRate: entry.matches ? entry.wins / entry.matches : 0,
      pointDifferential: entry.pointsFor - entry.pointsAgainst,
      rating: Math.round(
        entry.players.reduce(
          (total, player) =>
            total +
            (snapshot.playerRatings.get(player.id) ?? DOUBLES_ELO_BASE_RATING),
          0
        ) / entry.players.length
      ),
    }))
    .sort((a, b) => {
      if (b.rating === a.rating) {
        if (b.pointDifferential === a.pointDifferential) {
          return b.matches - a.matches;
        }
        return b.pointDifferential - a.pointDifferential;
      }
      return b.rating - a.rating;
    });
}

export function buildDoublesSummary(matches: DoublesMatch[]): DoublesSummary {
  const players = new Set<number>();
  const teams = new Set<string>();

  matches.forEach((match) => {
    match.teamOnePlayers.forEach((player) => players.add(player.id));
    match.teamTwoPlayers.forEach((player) => players.add(player.id));
    teams.add(
      match.teamOnePlayers
        .map((player) => player.id)
        .sort((left, right) => left - right)
        .join("-")
    );
    teams.add(
      match.teamTwoPlayers
        .map((player) => player.id)
        .sort((left, right) => left - right)
        .join("-")
    );
  });

  return {
    matches: matches.length,
    activePlayers: players.size,
    activeTeams: teams.size,
  };
}
