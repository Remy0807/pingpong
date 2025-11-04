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
  // Optional Elo rating for the current season (if provided by the API)
  rating?: number;
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
  // Elo change for this match (positive/negative). Provided by the server when available.
  playerOneEloDelta?: number;
  playerTwoEloDelta?: number;
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
  // Elo rating for the season. Newer ranking method based on Elo algorithm.
  rating: number;
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

export type MatchRecommendation = {
  playerOne: {
    id: number;
    name: string;
  };
  playerTwo: {
    id: number;
    name: string;
  };
  score: number;
  ratingDiff: number | null;
  seasonMeetings: number;
  totalMeetings: number;
  lastPlayedAt: string | null;
  reasons: string[];
  record: {
    playerOneWins: number;
    playerTwoWins: number;
  };
};
