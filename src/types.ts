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

export type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type FriendshipStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "BLOCKED";

export type FriendDirection = "incoming" | "outgoing" | "accepted";

export type FriendEntry = {
  id: number;
  status: FriendshipStatus;
  direction: FriendDirection;
  createdAt: string;
  updatedAt: string;
  user: AuthUser;
};

export type FriendsResponse = {
  friends: FriendEntry[];
  pending: {
    sent: FriendEntry[];
    received: FriendEntry[];
  };
  declined: FriendEntry[];
};

export type GroupRole = "OWNER" | "ADMIN" | "MEMBER";

export type GroupMemberSummary = {
  id: number;
  role: GroupRole;
  joinedAt: string;
  updatedAt: string;
  isYou: boolean;
  user: AuthUser;
};

export type GroupSummary = {
  id: number;
  name: string;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
  yourRole: GroupRole | null;
  members: GroupMemberSummary[];
};

export type GroupsResponse = {
  groups: GroupSummary[];
};

export type GroupInviteStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export type GroupInviteEntry = {
  id: number;
  status: GroupInviteStatus;
  direction: "incoming" | "outgoing";
  createdAt: string;
  updatedAt: string;
  group: {
    id: number;
    name: string;
    ownerId: number;
  };
  inviter: AuthUser;
  invitee: AuthUser;
};

export type GroupInvitesResponse = {
  invites: GroupInviteEntry[];
};
