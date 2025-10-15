export type Player = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type PlayerStats = {
  player: Player;
  wins: number;
  losses: number;
  matches: number;
  pointsFor: number;
  pointsAgainst: number;
  winRate: number;
  pointDifferential: number;
  badges: string[];
  currentStreak: number;
  longestStreak: number;
  championships: number;
  justReachedStreakFive?: boolean;
};

export type Match = {
  id: number;
  playedAt: string;
  playerOneId: number;
  playerTwoId: number;
  playerOnePoints: number;
  playerTwoPoints: number;
  winnerId: number;
  playerOne: Player;
  playerTwo: Player;
  winner: Player;
  season: SeasonRef | null;
  createdAt: string;
  updatedAt: string;
};

export type SeasonRef = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
};

export type SeasonStanding = {
  player: {
    id: number;
    name: string;
  };
  wins: number;
  losses: number;
  matches: number;
  pointsFor: number;
  pointsAgainst: number;
  winRate: number;
  pointDifferential: number;
};

export type SeasonSummary = SeasonRef & {
  matches: number;
  champion: {
    id: number;
    name: string;
  } | null;
  standings: SeasonStanding[];
};
