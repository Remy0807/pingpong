import "dotenv/config";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import {
  createPlayerBadge,
  type BadgeId,
  type PlayerBadge,
} from "../shared/badges.js";
import {
  store,
  type DoublesMatchWithRelations,
  type MatchWithRelations,
  type PlayerWithRelations,
  type SeasonRecord,
} from "./firebaseStore.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;
const adminAuth = getAuth();
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");

type StoreErrorWithCode = { code: string };

const isStoreErrorWithCode = (
  error: unknown
): error is StoreErrorWithCode => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
};

type AuthedRequest = Request & {
  firebaseUser?: DecodedIdToken;
};

const getBearerToken = (req: Request) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim() || null;
};

const requireAuth = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ message: "Inloggen vereist." });
    }
    req.firebaseUser = await adminAuth.verifyIdToken(token);
    return next();
  } catch (error) {
    console.error("Auth verificatie mislukt", error);
    return res.status(401).json({ message: "Inloggen vereist." });
  }
};

const requireGroupId = (req: Request) => {
  const groupId = req.headers["x-group-id"];
  if (typeof groupId !== "string" || !groupId.trim()) {
    return null;
  }
  return groupId.trim();
};

const getFirebaseUserInfo = (req: AuthedRequest) => {
  const firebaseUser = req.firebaseUser;
  if (!firebaseUser) {
    return null;
  }
  return {
    uid: firebaseUser.uid,
    email:
      typeof firebaseUser.email === "string" && firebaseUser.email.trim()
        ? firebaseUser.email
        : null,
    displayName:
      typeof firebaseUser.name === "string" && firebaseUser.name.trim()
      ? firebaseUser.name
        : null,
  };
};

const getRequestContext = async (req: AuthedRequest, res: Response) => {
  const user = getFirebaseUserInfo(req);
  if (!user) {
    res.status(401).json({ message: "Inloggen vereist." });
    return null;
  }

  const groupId = requireGroupId(req);
  if (!groupId) {
    res.status(400).json({ message: "Groep ontbreekt." });
    return null;
  }

  const isMember = await store.isMemberOfGroup(user.uid, groupId);
  if (!isMember) {
    res.status(403).json({ message: "Je hebt geen toegang tot deze groep." });
    return null;
  }

  return { user, groupId };
};

app.use(cors());
app.use(express.json());
app.use("/api", requireAuth);

const seasonCreationLocks = new Map<string, Promise<SeasonRecord>>();

const getSeasonKey = (groupId: string, date: Date) =>
  `${groupId}:${date.getFullYear()}-${date.getMonth()}`;

const getSeasonBoundaries = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  return { start, end };
};

const buildSeasonName = (date: Date) => {
  return `${date.toLocaleString("nl-NL", {
    month: "long",
  })} ${date.getFullYear()}`.replace(/^\w/, (c) => c.toUpperCase());
};

async function deduplicateSeasons() {
  return store.deleteDuplicateSeasons();
}

async function getOrCreateSeasonForDate(groupId: string, date: Date) {
  const key = getSeasonKey(groupId, date);
  const pending = seasonCreationLocks.get(key);
  if (pending) {
    return pending;
  }

  const operation = (async (): Promise<SeasonRecord> => {
    const { start, end } = getSeasonBoundaries(date);
    const existing = await store.findSeasonForDate(groupId, date);

    if (existing) {
      return existing;
    }

    try {
      return await store.createSeason(groupId, {
        name: `Seizoen ${buildSeasonName(date)}`,
        startDate: start,
        endDate: end,
      });
    } catch (error) {
      if (isStoreErrorWithCode(error) && error.code === "P2002") {
        const createdByOtherRequest = await store.findSeasonByBoundaries(
          groupId,
          start,
          end
        );
        if (createdByOtherRequest) {
          return createdByOtherRequest;
        }
      }
      throw error;
    }
  })();

  seasonCreationLocks.set(key, operation);
  try {
    return await operation;
  } finally {
    seasonCreationLocks.delete(key);
  }
}

const calculatePlayerEnhancements = (
  player: PlayerWithRelations,
  currentSeason: Awaited<ReturnType<typeof getOrCreateSeasonForDate>>,
  championCounts: Map<number, number>
) => {
  const matches = [
    ...player.matchesAsPlayerOne,
    ...player.matchesAsPlayerTwo,
  ].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  for (const match of matches) {
    const didWin = match.winnerId === player.id;
    if (didWin) {
      streak += 1;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 0;
    }
  }

  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i];
    if (match.winnerId === player.id) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  const seasonMatches = matches.filter(
    (match) =>
      match.playedAt >= currentSeason.startDate &&
      match.playedAt <= currentSeason.endDate
  );
  const seasonWins = seasonMatches.filter(
    (match) => match.winnerId === player.id
  ).length;
  const seasonLosses = seasonMatches.length - seasonWins;
  const badges: PlayerBadge[] = [];
  const awardBadge = (id: BadgeId, earnedAt?: Date) => {
    if (badges.some((badge) => badge.id === id)) {
      return;
    }
    const badge = createPlayerBadge(id, earnedAt);
    if (badge) {
      badges.push(badge);
    }
  };

  const lastMatch = matches.length
    ? matches[matches.length - 1]
    : undefined;
  const lastMatchDate = lastMatch?.playedAt;
  const seasonPoints = seasonMatches.reduce(
    (acc, match) => {
      const isPlayerOne = match.playerOneId === player.id;
      const scored = isPlayerOne ? match.playerOnePoints : match.playerTwoPoints;
      const conceded = isPlayerOne ? match.playerTwoPoints : match.playerOnePoints;
      return {
        for: acc.for + scored,
        against: acc.against + conceded,
      };
    },
    { for: 0, against: 0 }
  );

  if (currentStreak >= 3 && lastMatchDate) {
    awardBadge("in-form", lastMatchDate);
  }
  if (seasonMatches.length >= 3 && seasonLosses === 0 && lastMatchDate) {
    awardBadge("perfect-month", lastMatchDate);
  }
  if (
    seasonMatches.length >= 5 &&
    seasonWins / (seasonMatches.length || 1) >= 0.75 &&
    lastMatchDate
  ) {
    awardBadge("dominance", lastMatchDate);
  }
  if (seasonMatches.length >= 10 && lastMatchDate) {
    awardBadge("marathoner", lastMatchDate);
  }

  let winMachineDate: Date | undefined;
  let cleanSheetDate: Date | undefined;
  let pointsCollectorDate: Date | undefined;

  let streakCounter = 0;
  for (const match of matches) {
    const didWin = match.winnerId === player.id;
    const isPlayerOne = match.playerOneId === player.id;
    const opponentPoints = isPlayerOne
      ? match.playerTwoPoints
      : match.playerOnePoints;
    if (didWin) {
      streakCounter += 1;
      if (streakCounter >= 5 && !winMachineDate) {
        winMachineDate = match.playedAt;
      }
      if (opponentPoints <= 5 && !cleanSheetDate) {
        cleanSheetDate = match.playedAt;
      }
    } else {
      streakCounter = 0;
    }
  }

  if (longestStreak >= 5 && winMachineDate) {
    awardBadge("win-machine", winMachineDate);
  }
  if (cleanSheetDate) {
    awardBadge("clean-sheet", cleanSheetDate);
  }
  if (seasonPoints.for >= 250) {
    const latestSeasonMatch = seasonMatches.length
      ? seasonMatches[seasonMatches.length - 1].playedAt
      : undefined;
    pointsCollectorDate = latestSeasonMatch ?? lastMatchDate;
  }
  if (pointsCollectorDate) {
    awardBadge("points-collector", pointsCollectorDate);
  }

  const championships = championCounts.get(player.id) ?? 0;
  const justReachedStreakFive = currentStreak === 5;

  return {
    badges,
    currentStreak,
    longestStreak,
    championships,
    justReachedStreakFive,
  };
};

const buildPlayerStats = (
  player: PlayerWithRelations,
  context: {
    currentSeason: Awaited<ReturnType<typeof getOrCreateSeasonForDate>>;
    championCounts: Map<number, number>;
  }
) => {
  const matches = [...player.matchesAsPlayerOne, ...player.matchesAsPlayerTwo];
  const wins = player.matchesWon.length;
  const losses = matches.length - wins;

  const points = matches.reduce(
    (acc, match) => {
      const isPlayerOne = match.playerOneId === player.id;
      const scored = isPlayerOne
        ? match.playerOnePoints
        : match.playerTwoPoints;
      const conceded = isPlayerOne
        ? match.playerTwoPoints
        : match.playerOnePoints;
      return {
        for: acc.for + scored,
        against: acc.against + conceded,
      };
    },
    { for: 0, against: 0 }
  );

  const winRate = matches.length ? wins / matches.length : 0;
  const pointDifferential = points.for - points.against;

  const enhancements = calculatePlayerEnhancements(
    player,
    context.currentSeason,
    context.championCounts
  );

  return {
    player: {
      id: player.id,
      uid: player.uid ?? null,
      name: player.name,
      createdAt: player.createdAt.toISOString(),
      updatedAt: player.updatedAt.toISOString(),
    },
    wins,
    losses,
    matches: matches.length,
    pointsFor: points.for,
    pointsAgainst: points.against,
    winRate,
    pointDifferential,
    badges: enhancements.badges,
    currentStreak: enhancements.currentStreak,
    longestStreak: enhancements.longestStreak,
    championships: enhancements.championships,
    justReachedStreakFive: enhancements.justReachedStreakFive,
  };
};

async function fetchPlayersWithRelations(groupId: string, playerId?: number) {
  return store.fetchPlayersWithRelations(groupId, playerId);
}

const getChampionCounts = async (groupId: string) => {
  return store.getChampionCounts(groupId);
};

type SeasonStanding = {
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
  // Elo rating for the season
  rating: number;
  pointDifferential: number;
};

// Calculate season standings using an Elo rating system.
// Each player starts at a base rating (1000). We process matches in chronological order
// and update ratings after each match using a standard Elo formula with K=32.
const calculateSeasonStandings = (
  matches: MatchWithRelations[]
): SeasonStanding[] => {
  // Build initial stats map and rating map
  const statsMap = new Map<
    number,
    {
      player: { id: number; name: string };
      wins: number;
      losses: number;
      matches: number;
      pointsFor: number;
      pointsAgainst: number;
      rating: number;
    }
  >();

  const BASE_RATING = 1000;
  const K = 32;

  // Ensure we have an entry for all players that appear in matches
  for (const match of matches) {
    const p1 = match.playerOne;
    const p2 = match.playerTwo;
    if (!statsMap.has(p1.id)) {
      statsMap.set(p1.id, {
        player: { id: p1.id, name: p1.name },
        wins: 0,
        losses: 0,
        matches: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        rating: BASE_RATING,
      });
    }
    if (!statsMap.has(p2.id)) {
      statsMap.set(p2.id, {
        player: { id: p2.id, name: p2.name },
        wins: 0,
        losses: 0,
        matches: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        rating: BASE_RATING,
      });
    }
  }

  // Process matches in chronological order and update ratings
  const sortedMatches = [...matches].sort(
    (a, b) => a.playedAt.getTime() - b.playedAt.getTime()
  );

  for (const match of sortedMatches) {
    const entryOne = statsMap.get(match.playerOneId)!;
    const entryTwo = statsMap.get(match.playerTwoId)!;

    // Update per-match aggregated stats
    entryOne.matches += 1;
    entryTwo.matches += 1;
    entryOne.pointsFor += match.playerOnePoints;
    entryOne.pointsAgainst += match.playerTwoPoints;
    entryTwo.pointsFor += match.playerTwoPoints;
    entryTwo.pointsAgainst += match.playerOnePoints;

    const Ra = entryOne.rating;
    const Rb = entryTwo.rating;
    const Ea = 1 / (1 + 10 ** ((Rb - Ra) / 400));
    const Eb = 1 - Ea;

    let Sa: number;
    let Sb: number;
    if (match.winnerId === match.playerOneId) {
      Sa = 1;
      Sb = 0;
      entryOne.wins += 1;
      entryTwo.losses += 1;
    } else {
      Sa = 0;
      Sb = 1;
      entryTwo.wins += 1;
      entryOne.losses += 1;
    }

    // Elo update
    entryOne.rating = Math.round(Ra + K * (Sa - Ea));
    entryTwo.rating = Math.round(Rb + K * (Sb - Eb));
  }

  // Convert to SeasonStanding array
  const standings = Array.from(statsMap.values()).map((entry) => ({
    player: entry.player,
    wins: entry.wins,
    losses: entry.losses,
    matches: entry.matches,
    pointsFor: entry.pointsFor,
    pointsAgainst: entry.pointsAgainst,
    winRate: entry.matches ? entry.wins / entry.matches : 0,
    rating: entry.rating,
    pointDifferential: entry.pointsFor - entry.pointsAgainst,
  }));

  // Sort by rating (desc), then by point differential, then by matches played
  standings.sort((a, b) => {
    if (b.rating === a.rating) {
      if (b.pointDifferential === a.pointDifferential) {
        return b.matches - a.matches;
      }
      return b.pointDifferential - a.pointDifferential;
    }
    return b.rating - a.rating;
  });

  return standings;
};

const ensurePastSeasonChampions = async () => {
  const now = new Date();
  const groups = await store.listGroups();

  await Promise.all(
    groups.map(async (group) => {
      const pastSeasons = await store.listPastSeasonsWithMatches(group.id, now);
      await Promise.all(
        pastSeasons.map(async (season) => {
          const standings = calculateSeasonStandings(season.matches);
          if (!standings.length) {
            return;
          }
          const championId = standings[0].player.id;
          if (season.championId === championId) {
            return;
          }
          await store.updateSeason(group.id, season.id, { championId });
        })
      );
    })
  );
};

type CurrentSeasonTopEntry = {
  rank: number;
  playerId: number;
  name: string;
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
  rating: number;
  pointDifferential: number;
};

const getCurrentSeasonLeaderboardSnapshot = async (groupId: string) => {
  const currentSeason = await getOrCreateSeasonForDate(groupId, new Date());
  const seasonMatches = (
    await Promise.all(
      (await store.listMatches(groupId))
        .filter((match) => match.seasonId === currentSeason.id)
        .map((match) => store.hydrateMatch(groupId, match))
    )
  ).sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());

  const standings = calculateSeasonStandings(seasonMatches);
  const topFive: CurrentSeasonTopEntry[] = standings
    .slice(0, 5)
    .map((entry, index) => ({
      rank: index + 1,
      playerId: entry.player.id,
      name: entry.player.name,
      wins: entry.wins,
      losses: entry.losses,
      matches: entry.matches,
      winRate: entry.winRate,
      rating: entry.rating,
      pointDifferential: entry.pointDifferential,
    }));

  return {
    currentSeason,
    topFive,
  };
};

const buildAdaptiveCard = (body: unknown[], actions: unknown[] = []) => ({
  $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
  type: "AdaptiveCard",
  version: "1.4",
  body,
  actions,
});

const matchDateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const buildSeasonTopRows = (entries: CurrentSeasonTopEntry[]) => {
  if (!entries.length) {
    return [
      {
        type: "TextBlock",
        text: "Nog geen ranking beschikbaar voor het huidige seizoen.",
        isSubtle: true,
        wrap: true,
      },
    ];
  }

  const header: unknown = {
    type: "ColumnSet",
    spacing: "Small",
    columns: [
      {
        type: "Column",
        width: "auto",
        items: [{ type: "TextBlock", text: "#", weight: "Bolder", size: "Small" }],
      },
      {
        type: "Column",
        width: "stretch",
        items: [{ type: "TextBlock", text: "Speler", weight: "Bolder", size: "Small" }],
      },
      {
        type: "Column",
        width: "auto",
        items: [{ type: "TextBlock", text: "Elo", weight: "Bolder", size: "Small" }],
      },
      {
        type: "Column",
        width: "auto",
        items: [
          { type: "TextBlock", text: "Record", weight: "Bolder", size: "Small" },
        ],
      },
      {
        type: "Column",
        width: "auto",
        items: [
          { type: "TextBlock", text: "Win%", weight: "Bolder", size: "Small" },
        ],
      },
    ],
  };

  const rows = entries.map((entry) => ({
    type: "ColumnSet",
    spacing: "Small",
    columns: [
      {
        type: "Column",
        width: "auto",
        items: [
          {
            type: "TextBlock",
            text: `${entry.rank}`,
            color: entry.rank === 1 ? "Accent" : "Default",
          },
        ],
      },
      {
        type: "Column",
        width: "stretch",
        items: [
          {
            type: "TextBlock",
            text: entry.name,
            weight: entry.rank <= 3 ? "Bolder" : "Default",
          },
        ],
      },
      {
        type: "Column",
        width: "auto",
        items: [
          {
            type: "TextBlock",
            text: `${entry.rating}`,
            color: "Good",
          },
        ],
      },
      {
        type: "Column",
        width: "auto",
        items: [
          {
            type: "TextBlock",
            text: `${entry.wins}W/${entry.losses}L`,
            wrap: true,
          },
        ],
      },
      {
        type: "Column",
        width: "auto",
        items: [
          {
            type: "TextBlock",
            text: `${Math.round(entry.winRate * 100)}%`,
            color: "Accent",
          },
        ],
      },
    ],
  }));

  return [header, ...rows];
};

const buildTeamsMatchCardBody = ({
  title,
  subtitle,
  match,
  currentSeasonName,
  topFive,
}: {
  title: string;
  subtitle: string;
  match: MatchWithRelations;
  currentSeasonName: string;
  topFive: CurrentSeasonTopEntry[];
}) => {
  const winnerPoints =
    match.winnerId === match.playerOneId
      ? match.playerOnePoints
      : match.playerTwoPoints;
  const loserPoints =
    match.winnerId === match.playerOneId
      ? match.playerTwoPoints
      : match.playerOnePoints;
  const margin = winnerPoints - loserPoints;

  return [
    {
      type: "TextBlock",
      text: title,
      weight: "Bolder",
      size: "Large",
    },
    {
      type: "TextBlock",
      text: subtitle,
      isSubtle: true,
      spacing: "None",
      wrap: true,
    },
    {
      type: "Container",
      style: "emphasis",
      spacing: "Medium",
      items: [
        {
          type: "ColumnSet",
          columns: [
            {
              type: "Column",
              width: "stretch",
              items: [
                {
                  type: "TextBlock",
                  text: `${match.playerOne.name} vs ${match.playerTwo.name}`,
                  weight: "Bolder",
                  size: "Medium",
                  wrap: true,
                },
                {
                  type: "TextBlock",
                  text: `Winnaar: ${match.winner.name} • Marge: +${margin}`,
                  spacing: "Small",
                  wrap: true,
                },
                {
                  type: "TextBlock",
                  text: `Gespeeld: ${matchDateFormatter.format(match.playedAt)}`,
                  isSubtle: true,
                  spacing: "Small",
                  wrap: true,
                },
                {
                  type: "TextBlock",
                  text: `Wedstrijdseizoen: ${match.season?.name ?? "Onbekend"}`,
                  isSubtle: true,
                  spacing: "None",
                  wrap: true,
                },
              ],
            },
            {
              type: "Column",
              width: "auto",
              verticalContentAlignment: "Center",
              items: [
                {
                  type: "TextBlock",
                  text: "Score",
                  horizontalAlignment: "Center",
                  isSubtle: true,
                  size: "Small",
                },
                {
                  type: "TextBlock",
                  text: `${match.playerOnePoints} - ${match.playerTwoPoints}`,
                  size: "ExtraLarge",
                  weight: "Bolder",
                  horizontalAlignment: "Center",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "TextBlock",
      text: `Top 5 huidig seizoen (${currentSeasonName})`,
      weight: "Bolder",
      spacing: "Medium",
    },
    ...buildSeasonTopRows(topFive),
  ];
};

const sendTeamsCard = async (cardContent: unknown) => {
  if (!TEAMS_WEBHOOK_URL) {
    return;
  }

  const payload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: cardContent,
      },
    ],
  };

  const response = await fetch(TEAMS_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(
      "Teams webhook responded with",
      response.status,
      await response.text()
    );
  }
};

const notifyTeamsMatchCreated = async (match: MatchWithRelations) => {
  try {
    const { currentSeason, topFive } = await getCurrentSeasonLeaderboardSnapshot(
      match.groupId
    );
    const body = buildTeamsMatchCardBody({
      title: "Nieuwe wedstrijd geregistreerd",
      subtitle: "Scorekaart geupdate en klassement ververst.",
      match,
      currentSeasonName: currentSeason.name,
      topFive,
    });

    await sendTeamsCard(buildAdaptiveCard(body));
  } catch (error) {
    console.error("Kon Teams niet notificeren", error);
  }
};

const notifyTeamsPlayerChange = async (payload: {
  type: "created" | "updated" | "deleted";
  name: string;
  previousName?: string;
}) => {
  try {
    const body: unknown[] = [
      {
        type: "TextBlock",
        text:
          payload.type === "created"
            ? "Nieuwe speler toegevoegd"
            : payload.type === "updated"
            ? "Speler bijgewerkt"
            : "Speler verwijderd",
        weight: "Bolder",
        size: "Medium",
      },
      {
        type: "TextBlock",
        text:
          payload.type === "created"
            ? `${payload.name} is toegevoegd aan de competitie.`
            : payload.type === "updated"
            ? `${payload.previousName ?? payload.name} heet nu ${payload.name}.`
            : `${payload.name} is uit de competitie verwijderd.`,
        wrap: true,
      },
    ];

    await sendTeamsCard(buildAdaptiveCard(body));
  } catch (error) {
    console.error("Kon Teams niet notificeren", error);
  }
};

const notifyTeamsMatchUpdated = async (match: MatchWithRelations) => {
  try {
    const { currentSeason, topFive } = await getCurrentSeasonLeaderboardSnapshot(
      match.groupId
    );
    const body = buildTeamsMatchCardBody({
      title: "Wedstrijd bijgewerkt",
      subtitle: "Resultaat aangepast en klassement opnieuw berekend.",
      match,
      currentSeasonName: currentSeason.name,
      topFive,
    });

    await sendTeamsCard(buildAdaptiveCard(body));
  } catch (error) {
    console.error("Kon Teams niet notificeren", error);
  }
};

const notifyTeamsMatchDeleted = async (match: MatchWithRelations) => {
  try {
    const { currentSeason, topFive } = await getCurrentSeasonLeaderboardSnapshot(
      match.groupId
    );
    const body = buildTeamsMatchCardBody({
      title: "Wedstrijd verwijderd",
      subtitle: "Resultaat teruggedraaid en huidig seizoen opnieuw gerankt.",
      match,
      currentSeasonName: currentSeason.name,
      topFive,
    });

    await sendTeamsCard(buildAdaptiveCard(body));
  } catch (error) {
    console.error("Kon Teams niet notificeren", error);
  }
};

const serializePlayer = (player: {
  id: number;
  name: string;
  uid?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...player,
  createdAt: player.createdAt.toISOString(),
  updatedAt: player.updatedAt.toISOString(),
});

const serializeSeason = (
  season:
    | {
        id: number;
        groupId?: string;
        name: string;
        startDate: Date;
        endDate: Date;
      }
    | null
    | undefined
) =>
  season
    ? {
        id: season.id,
        name: season.name,
        startDate: season.startDate.toISOString(),
        endDate: season.endDate.toISOString(),
      }
    : null;

const serializeMatch = (match: MatchWithRelations) => ({
  ...match,
  playedAt: match.playedAt.toISOString(),
  playerOne: serializePlayer(match.playerOne),
  playerTwo: serializePlayer(match.playerTwo),
  winner: serializePlayer(match.winner),
  season: serializeSeason(match.season),
  createdAt: match.createdAt.toISOString(),
  updatedAt: match.updatedAt.toISOString(),
});

const serializeDoublesMatch = (match: DoublesMatchWithRelations) => ({
  ...match,
  playedAt: match.playedAt.toISOString(),
  teamOnePlayerA: serializePlayer(match.teamOnePlayerA),
  teamOnePlayerB: serializePlayer(match.teamOnePlayerB),
  teamTwoPlayerA: serializePlayer(match.teamTwoPlayerA),
  teamTwoPlayerB: serializePlayer(match.teamTwoPlayerB),
  teamOnePlayers: [
    serializePlayer(match.teamOnePlayerA),
    serializePlayer(match.teamOnePlayerB),
  ],
  teamTwoPlayers: [
    serializePlayer(match.teamTwoPlayerA),
    serializePlayer(match.teamTwoPlayerB),
  ],
  season: serializeSeason(match.season),
  createdAt: match.createdAt.toISOString(),
  updatedAt: match.updatedAt.toISOString(),
});

const serializePortalUser = (user: {
  uid: string;
  email: string | null;
  displayName: string | null;
}) => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
});

const serializePortalGroup = (group: {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: group.id,
  name: group.name,
  ownerUid: group.ownerUid,
  createdAt: group.createdAt.toISOString(),
  updatedAt: group.updatedAt.toISOString(),
});

const serializePortalMembership = (membership: {
  uid: string;
  groupId: string;
  role: "owner" | "member";
  joinedAt: Date;
}) => ({
  uid: membership.uid,
  groupId: membership.groupId,
  role: membership.role,
  joinedAt: membership.joinedAt.toISOString(),
});

const serializePortalUserRecord = (user: {
  uid: string;
  email: string | null;
  displayName: string | null;
}) => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
});

const validateDoublesPlayerIds = (playerIds: number[]) => {
  if (playerIds.some((playerId) => !Number.isInteger(playerId))) {
    return "Ongeldige invoer.";
  }

  if (new Set(playerIds).size !== 4) {
    return "In een 2v2-wedstrijd moet elke speler uniek zijn.";
  }

  return null;
};

// Helper to compute Elo deltas per match grouped by season
const computeEloDeltas = (matches: MatchWithRelations[]) => {
  const BASE_RATING = 1000;
  const K = 32;
  const deltas = new Map<
    number,
    { playerOneDelta: number; playerTwoDelta: number }
  >();

  // Group matches by season id
  const bySeason = new Map<number, MatchWithRelations[]>();
  for (const m of matches) {
    const sid = m.season ? m.season.id : 0;
    const arr = bySeason.get(sid) ?? [];
    arr.push(m);
    bySeason.set(sid, arr);
  }

  for (const [_sid, seasonMatches] of bySeason.entries()) {
    // sort chronological
    const sorted = [...seasonMatches].sort(
      (a, b) => a.playedAt.getTime() - b.playedAt.getTime()
    );

    const ratingMap = new Map<number, number>();

    for (const match of sorted) {
      // init ratings
      if (!ratingMap.has(match.playerOneId))
        ratingMap.set(match.playerOneId, BASE_RATING);
      if (!ratingMap.has(match.playerTwoId))
        ratingMap.set(match.playerTwoId, BASE_RATING);

      const Ra = ratingMap.get(match.playerOneId)!;
      const Rb = ratingMap.get(match.playerTwoId)!;
      const Ea = 1 / (1 + 10 ** ((Rb - Ra) / 400));
      const Eb = 1 - Ea;

      let Sa = 0;
      let Sb = 0;
      if (match.winnerId === match.playerOneId) {
        Sa = 1;
        Sb = 0;
      } else {
        Sa = 0;
        Sb = 1;
      }

      const deltaA = Math.round(K * (Sa - Ea));
      const deltaB = Math.round(K * (Sb - Eb));

      // apply
      ratingMap.set(match.playerOneId, Ra + deltaA);
      ratingMap.set(match.playerTwoId, Rb + deltaB);

      deltas.set(match.id, { playerOneDelta: deltaA, playerTwoDelta: deltaB });
    }
  }

  return deltas;
};

type MatchRecommendation = {
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

const buildMatchRecommendations = async (groupId: string) => {
  const now = new Date();
  const [currentSeason, players, matches, championCounts] = await Promise.all([
    getOrCreateSeasonForDate(groupId, now),
    fetchPlayersWithRelations(groupId),
    Promise.all(
      (await store.listMatches(groupId))
        .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
        .map((match) => store.hydrateMatch(groupId, match))
    ),
    getChampionCounts(groupId),
  ]);

  const playerStats = players.map((player) =>
    buildPlayerStats(player, { currentSeason, championCounts })
  );

  const playerStatsMap = new Map(playerStats.map((entry) => [entry.player.id, entry]));

  const seasonMatches = matches.filter(
    (match) => match.seasonId === currentSeason.id
  );

  const seasonMatchesPerPlayer = new Map<number, number>();
  seasonMatches.forEach((match) => {
    seasonMatchesPerPlayer.set(
      match.playerOneId,
      (seasonMatchesPerPlayer.get(match.playerOneId) ?? 0) + 1
    );
    seasonMatchesPerPlayer.set(
      match.playerTwoId,
      (seasonMatchesPerPlayer.get(match.playerTwoId) ?? 0) + 1
    );
  });

  const seasonStandings = calculateSeasonStandings(seasonMatches);
  const ratingMap = new Map<number, number>();
  seasonStandings.forEach((standing) => {
    ratingMap.set(standing.player.id, standing.rating);
  });

  type PairKey = `${number}-${number}`;
  type PairStats = {
    playerAId: number;
    playerBId: number;
    playerAWins: number;
    playerBWins: number;
    totalMatches: number;
    seasonMatches: number;
    lastPlayedAt: Date | null;
  };

  const pairStatsMap = new Map<PairKey, PairStats>();

  const makeKey = (idA: number, idB: number): PairKey =>
    idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;

  matches.forEach((match) => {
    const idA = Math.min(match.playerOneId, match.playerTwoId);
    const idB = Math.max(match.playerOneId, match.playerTwoId);
    const key = makeKey(idA, idB);
    const pairStats =
      pairStatsMap.get(key) ??
      {
        playerAId: idA,
        playerBId: idB,
        playerAWins: 0,
        playerBWins: 0,
        totalMatches: 0,
        seasonMatches: 0,
        lastPlayedAt: null,
      };

    pairStats.totalMatches += 1;
    if (match.winnerId === idA) {
      pairStats.playerAWins += 1;
    } else if (match.winnerId === idB) {
      pairStats.playerBWins += 1;
    }
    if (match.seasonId === currentSeason.id) {
      pairStats.seasonMatches += 1;
    }
    if (
      !pairStats.lastPlayedAt ||
      match.playedAt.getTime() > pairStats.lastPlayedAt.getTime()
    ) {
      pairStats.lastPlayedAt = match.playedAt;
    }

    pairStatsMap.set(key, pairStats);
  });

  const eligiblePlayers = playerStats.filter((entry) => entry.matches > 0);
  for (let i = 0; i < eligiblePlayers.length; i += 1) {
    for (let j = i + 1; j < eligiblePlayers.length; j += 1) {
      const playerAId = eligiblePlayers[i].player.id;
      const playerBId = eligiblePlayers[j].player.id;
      const key = makeKey(playerAId, playerBId);
      if (!pairStatsMap.has(key)) {
        pairStatsMap.set(key, {
          playerAId,
          playerBId,
          playerAWins: 0,
          playerBWins: 0,
          totalMatches: 0,
          seasonMatches: 0,
          lastPlayedAt: null,
        });
      }
    }
  }

  const recommendations: MatchRecommendation[] = [];

  pairStatsMap.forEach((pairStats) => {
    const playerA = playerStatsMap.get(pairStats.playerAId);
    const playerB = playerStatsMap.get(pairStats.playerBId);
    if (!playerA || !playerB) {
      return;
    }

    const reasons: string[] = [];
    let score = 0;

    const playerASeasonMatches = seasonMatchesPerPlayer.get(
      pairStats.playerAId
    ) ?? 0;
    const playerBSeasonMatches = seasonMatchesPerPlayer.get(
      pairStats.playerBId
    ) ?? 0;

    if (playerASeasonMatches === 0 && playerBSeasonMatches === 0) {
      return;
    }

    if (pairStats.seasonMatches === 0) {
      reasons.push("Nog niet tegen elkaar gespeeld dit seizoen.");
      score += 40;
    } else if (pairStats.lastPlayedAt) {
      const daysSince =
        (now.getTime() - pairStats.lastPlayedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince >= 21) {
        reasons.push("Al even geen onderlinge wedstrijd geweest.");
        score += 10;
      }
    }

    const totalDiff = Math.abs(pairStats.playerAWins - pairStats.playerBWins);
    if (pairStats.totalMatches > 0 && totalDiff <= 1) {
      reasons.push("Bijna gelijke historische stand.");
      score += 20;
    }
    if (pairStats.totalMatches === 0) {
      reasons.push("Nog nooit tegen elkaar gespeeld.");
      score += 15;
    }

    const ratingA = ratingMap.get(pairStats.playerAId) ?? 1000;
    const ratingB = ratingMap.get(pairStats.playerBId) ?? 1000;
    const ratingDiff = Math.abs(ratingA - ratingB);
    if (ratingDiff <= 40) {
      reasons.push("Elo ratings liggen dicht bij elkaar.");
      score += 15;
    } else if (ratingDiff <= 100) {
      score += 5;
    }

    if (playerA.currentStreak >= 2 && playerB.currentStreak >= 2) {
      reasons.push("Beide spelers zitten in een vormpiek.");
      score += 10;
    }

    if (playerASeasonMatches >= 3 && playerBSeasonMatches >= 3) {
      reasons.push("Beide spelers zijn actief dit seizoen.");
      score += 5;
    }

    if (reasons.length === 0 || score <= 0) {
      return;
    }

    recommendations.push({
      playerOne: {
        id: playerA.player.id,
        name: playerA.player.name,
      },
      playerTwo: {
        id: playerB.player.id,
        name: playerB.player.name,
      },
      score,
      ratingDiff: ratingDiff || null,
      seasonMeetings: pairStats.seasonMatches,
      totalMeetings: pairStats.totalMatches,
      lastPlayedAt: pairStats.lastPlayedAt
        ? pairStats.lastPlayedAt.toISOString()
        : null,
      reasons,
      record: {
        playerOneWins: pairStats.playerAWins,
        playerTwoWins: pairStats.playerBWins,
      },
    });
  });

  recommendations.sort((a, b) => {
    if (b.score === a.score) {
      const aTime = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0;
      const bTime = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0;
      return aTime - bTime;
    }
    return b.score - a.score;
  });

  return {
    season: {
      id: currentSeason.id,
      name: currentSeason.name,
      startDate: currentSeason.startDate.toISOString(),
      endDate: currentSeason.endDate.toISOString(),
    },
    recommendations: recommendations.slice(0, 12),
  };
};

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/portal/session", async (req, res, next) => {
  try {
    const user = getFirebaseUserInfo(req as AuthedRequest);
    if (!user) {
      return res.status(401).json({ message: "Inloggen vereist." });
    }

    const activeGroupId = requireGroupId(req);
    const session = await store.getPortalSession(user, activeGroupId);
    res.json({
      user: serializePortalUser(session.user),
      groups: session.groups.map((group) => ({
        ...serializePortalGroup(group),
        memberCount: group.memberCount,
      })),
      memberships: session.memberships.map(serializePortalMembership),
      activeGroupId: session.activeGroupId,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/portal/groups", async (req, res, next) => {
  try {
    const user = getFirebaseUserInfo(req as AuthedRequest);
    if (!user) {
      return res.status(401).json({ message: "Inloggen vereist." });
    }

    const [groups, memberships] = await Promise.all([
      store.listGroups(),
      store.listMemberships(),
    ]);
    res.json(
      groups.map((group) => ({
        ...serializePortalGroup(group),
        memberCount: memberships.filter((membership) => membership.groupId === group.id).length,
      }))
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/portal/groups", async (req, res, next) => {
  try {
    const user = getFirebaseUserInfo(req as AuthedRequest);
    if (!user) {
      return res.status(401).json({ message: "Inloggen vereist." });
    }

    const { name, joinCode } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Groepsnaam is verplicht." });
    }
    if (typeof joinCode !== "string" || !joinCode.trim()) {
      return res.status(400).json({ message: "Geheime code is verplicht." });
    }

    const result = await store.createGroup({
      ownerUid: user.uid,
      name,
      joinCode,
      ownerEmail: user.email,
      ownerDisplayName: user.displayName,
    });

    res.status(201).json({
      group: {
        ...serializePortalGroup(result.group),
        memberCount: 1,
      },
      membership: serializePortalMembership(result.membership),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/portal/groups/:groupId/join", async (req, res, next) => {
  try {
    const user = getFirebaseUserInfo(req as AuthedRequest);
    if (!user) {
      return res.status(401).json({ message: "Inloggen vereist." });
    }

    const { groupId } = req.params;
    const { joinCode } = req.body ?? {};
    if (typeof joinCode !== "string" || !joinCode.trim()) {
      return res.status(400).json({ message: "Geheime code is verplicht." });
    }

    const result = await store.joinGroup({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      groupId,
      joinCode,
    });

    const members = await store.listMemberships();
    res.status(200).json({
      group: {
        ...serializePortalGroup(result.group),
        memberCount: members.filter((membership) => membership.groupId === groupId).length,
      },
      membership: serializePortalMembership(result.membership),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/portal/groups/:groupId", async (req, res, next) => {
  try {
    const user = getFirebaseUserInfo(req as AuthedRequest);
    if (!user) {
      return res.status(401).json({ message: "Inloggen vereist." });
    }

    const { groupId } = req.params;
    const membership = await store.getMembership(user.uid, groupId);
    if (!membership) {
      return res.status(403).json({ message: "Je hebt geen toegang tot deze groep." });
    }

    const group = await store.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Groep niet gevonden." });
    }

    const memberships = await store.listMembershipsForGroup(groupId);
    const members = await Promise.all(
      memberships.map(async (groupMembership) => {
        const memberUser = await store.getPortalUser(groupMembership.uid);
        return {
          uid: groupMembership.uid,
          email: memberUser?.email ?? null,
          displayName:
            memberUser?.displayName ??
            (groupMembership.uid === group.ownerUid ? "Groepseigenaar" : null),
          role: groupMembership.role,
          joinedAt: groupMembership.joinedAt.toISOString(),
        };
      })
    );

    res.json({
      group: {
        ...serializePortalGroup(group),
        memberCount: memberships.length,
      },
      viewerRole: membership.role,
      joinCode: membership.role === "owner" ? group.joinCode : null,
      members: members.sort((left, right) => {
        if (left.role === right.role) {
          return (left.displayName ?? left.uid).localeCompare(
            right.displayName ?? right.uid,
            "nl-NL"
          );
        }
        return left.role === "owner" ? -1 : 1;
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/portal/groups/:groupId", async (req, res, next) => {
  try {
    const user = getFirebaseUserInfo(req as AuthedRequest);
    if (!user) {
      return res.status(401).json({ message: "Inloggen vereist." });
    }

    const { groupId } = req.params;
    const membership = await store.getMembership(user.uid, groupId);
    if (!membership) {
      return res.status(403).json({ message: "Je hebt geen toegang tot deze groep." });
    }
    if (membership.role !== "owner") {
      return res.status(403).json({ message: "Alleen de eigenaar kan dit aanpassen." });
    }

    const { name, joinCode } = req.body ?? {};
    if (name != null && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ message: "Groepsnaam is verplicht." });
    }
    if (joinCode != null && (typeof joinCode !== "string" || !joinCode.trim())) {
      return res.status(400).json({ message: "Geheime code is verplicht." });
    }

    const updated = await store.updateGroup(groupId, {
      name,
      joinCode,
    });

    const members = await store.listMembershipsForGroup(groupId);
    res.json({
      group: {
        ...serializePortalGroup(updated),
        memberCount: members.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/portal/groups/:groupId/members/:uid", async (req, res, next) => {
  try {
    const user = getFirebaseUserInfo(req as AuthedRequest);
    if (!user) {
      return res.status(401).json({ message: "Inloggen vereist." });
    }

    const { groupId, uid } = req.params;
    const membership = await store.getMembership(user.uid, groupId);
    if (!membership) {
      return res.status(403).json({ message: "Je hebt geen toegang tot deze groep." });
    }
    if (membership.role !== "owner") {
      return res.status(403).json({ message: "Alleen de eigenaar kan leden verwijderen." });
    }
    if (uid === user.uid) {
      return res.status(400).json({ message: "Je kunt jezelf niet verwijderen." });
    }

    await store.removeMembership(groupId, uid);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete("/api/portal/groups/:groupId/membership", async (req, res, next) => {
  try {
    const user = getFirebaseUserInfo(req as AuthedRequest);
    if (!user) {
      return res.status(401).json({ message: "Inloggen vereist." });
    }

    const { groupId } = req.params;
    const membership = await store.getMembership(user.uid, groupId);
    if (!membership) {
      return res.status(403).json({ message: "Je hebt geen toegang tot deze groep." });
    }
    if (membership.role === "owner") {
      return res.status(400).json({ message: "De eigenaar kan de groep niet verlaten." });
    }

    await store.removeMembership(groupId, user.uid);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

const monthKeyForDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabelForDate = (date: Date) =>
  date.toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
  });

const buildMonthWindow = (count: number, now = new Date()) => {
  const months: { key: string; label: string; matches: number; wins: number; losses: number; pointsFor: number; pointsAgainst: number }[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push({
      key: monthKeyForDate(date),
      label: monthLabelForDate(date),
      matches: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }
  return months;
};

app.get("/api/account/overview", async (req, res, next) => {
  try {
    const user = getFirebaseUserInfo(req as AuthedRequest);
    if (!user) {
      return res.status(401).json({ message: "Inloggen vereist." });
    }

    const [groups, memberships, allMemberships] = await Promise.all([
      store.listGroups(),
      store.listMembershipsForUser(user.uid),
      store.listMemberships(),
    ]);
    const groupMap = new Map(groups.map((group) => [group.id, group]));
    const now = new Date();
    const monthlyHistory = buildMonthWindow(12, now);
    const monthMap = new Map(monthlyHistory.map((entry) => [entry.key, entry]));
    const recentMatches: Array<{
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
    }> = [];
    const groupSummaries = new Map<
      string,
      {
        group: {
          id: string;
          name: string;
          ownerUid: string;
          createdAt: string;
          updatedAt: string;
          memberCount: number;
        };
        role: "owner" | "member";
        matches: number;
        wins: number;
        losses: number;
        lastPlayedAt: string | null;
      }
    >();

    for (const membership of memberships) {
      const group = groupMap.get(membership.groupId);
      if (!group) {
        continue;
      }

      const player = await store.getPlayerByUid(group.id, user.uid);
      if (!player) {
        continue;
      }

      const groupMemberships = allMemberships.filter(
        (entry) => entry.groupId === group.id
      );
      const groupSummary = {
        group: {
          ...serializePortalGroup(group),
          memberCount: groupMemberships.length,
        },
        role: membership.role,
        matches: 0,
        wins: 0,
        losses: 0,
        lastPlayedAt: null as string | null,
      };

      const matches = await Promise.all(
        (await store.listMatches(group.id))
          .filter(
            (match) =>
              match.playerOneId === player.id || match.playerTwoId === player.id
          )
          .map((match) => store.hydrateMatch(group.id, match))
      );

      for (const match of matches) {
        const isPlayerOne = match.playerOneId === player.id;
        const won = match.winnerId === player.id;
        const scored = isPlayerOne
          ? match.playerOnePoints
          : match.playerTwoPoints;
        const conceded = isPlayerOne
          ? match.playerTwoPoints
          : match.playerOnePoints;
        const key = monthKeyForDate(match.playedAt);
        const bucket = monthMap.get(key);
        if (bucket) {
          bucket.matches += 1;
          bucket.wins += won ? 1 : 0;
          bucket.losses += won ? 0 : 1;
          bucket.pointsFor += scored;
          bucket.pointsAgainst += conceded;
        }
        groupSummary.matches += 1;
        groupSummary.wins += won ? 1 : 0;
        groupSummary.losses += won ? 0 : 1;
        groupSummary.lastPlayedAt = (
          groupSummary.lastPlayedAt == null ||
          match.playedAt.toISOString() > groupSummary.lastPlayedAt
            ? match.playedAt.toISOString()
            : groupSummary.lastPlayedAt
        );
        recentMatches.push({
          id: `s-${group.id}-${match.id}`,
          groupId: group.id,
          groupName: group.name,
          playedAt: match.playedAt.toISOString(),
          kind: "singles",
          title: `${won ? "Gewonnen" : "Verloren"} tegen ${
            isPlayerOne ? match.playerTwo.name : match.playerOne.name
          }`,
          detail: `${scored}-${conceded} · ${match.season?.name ?? "Geen seizoen"}`,
          won,
          scored,
          conceded,
        });
      }

      const doublesMatches = await Promise.all(
        (await store.listDoublesMatches(group.id))
          .filter((match) =>
            [
              match.teamOnePlayerAId,
              match.teamOnePlayerBId,
              match.teamTwoPlayerAId,
              match.teamTwoPlayerBId,
            ].includes(player.id)
          )
          .map((match) => store.hydrateDoublesMatch(group.id, match))
      );

      for (const match of doublesMatches) {
        const inTeamOne =
          match.teamOnePlayerAId === player.id ||
          match.teamOnePlayerBId === player.id;
        const won = match.winnerTeam === (inTeamOne ? 1 : 2);
        const scored = inTeamOne ? match.teamOnePoints : match.teamTwoPoints;
        const conceded = inTeamOne ? match.teamTwoPoints : match.teamOnePoints;
        const key = monthKeyForDate(match.playedAt);
        const bucket = monthMap.get(key);
        if (bucket) {
          bucket.matches += 1;
          bucket.wins += won ? 1 : 0;
          bucket.losses += won ? 0 : 1;
          bucket.pointsFor += scored;
          bucket.pointsAgainst += conceded;
        }
        groupSummary.matches += 1;
        groupSummary.wins += won ? 1 : 0;
        groupSummary.losses += won ? 0 : 1;
        groupSummary.lastPlayedAt = (
          groupSummary.lastPlayedAt == null ||
          match.playedAt.toISOString() > groupSummary.lastPlayedAt
            ? match.playedAt.toISOString()
            : groupSummary.lastPlayedAt
        );
        recentMatches.push({
          id: `d-${group.id}-${match.id}`,
          groupId: group.id,
          groupName: group.name,
          playedAt: match.playedAt.toISOString(),
          kind: "doubles",
          title: `${won ? "Gewonnen" : "Verloren"} in 2v2`,
          detail: `${scored}-${conceded} · ${match.season?.name ?? "Geen seizoen"}`,
          won,
          scored,
          conceded,
        });
      }

      groupSummaries.set(group.id, groupSummary);
    }

    const totals = monthlyHistory.reduce(
      (acc, month) => {
        acc.matches += month.matches;
        acc.wins += month.wins;
        acc.losses += month.losses;
        acc.pointsFor += month.pointsFor;
        acc.pointsAgainst += month.pointsAgainst;
        return acc;
      },
      {
        matches: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      }
    );

    const recentSorted = recentMatches
      .sort((a, b) => (a.playedAt < b.playedAt ? 1 : -1))
      .slice(0, 12);

    res.json({
      user: serializePortalUserRecord(user),
      memberships: memberships.map(serializePortalMembership),
      groups: groups.map((group) => ({
        ...serializePortalGroup(group),
        memberCount: allMemberships.filter((membership) => membership.groupId === group.id).length,
      })),
      totals: {
        matches: totals.matches,
        wins: totals.wins,
        losses: totals.losses,
        winRate: totals.matches ? totals.wins / totals.matches : 0,
        pointsFor: totals.pointsFor,
        pointsAgainst: totals.pointsAgainst,
        groupsPlayed: groupSummaries.size,
      },
      currentMonth: monthlyHistory[monthlyHistory.length - 1] ?? null,
      monthlyHistory,
      recentMatches: recentSorted,
      groupSummaries: Array.from(groupSummaries.values()).sort((left, right) => {
        if (right.matches === left.matches) {
          return (right.lastPlayedAt ?? "").localeCompare(left.lastPlayedAt ?? "");
        }
        return right.matches - left.matches;
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/players", async (req, res, next) => {
  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }
    await ensurePastSeasonChampions();
    const [players, currentSeason, championCounts] = await Promise.all([
      fetchPlayersWithRelations(context.groupId),
      getOrCreateSeasonForDate(context.groupId, new Date()),
      getChampionCounts(context.groupId),
    ]);
    res.json(
      players.map((player) =>
        buildPlayerStats(player, { currentSeason, championCounts })
      )
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/players", async (req, res, next) => {
  const { name } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "Naam is verplicht." });
  }

  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }

    const player = await store.createPlayer(context.groupId, name.trim());

    const [playerWithRelations, currentSeason, championCounts] =
      await Promise.all([
        fetchPlayersWithRelations(context.groupId, player.id),
        getOrCreateSeasonForDate(context.groupId, new Date()),
        getChampionCounts(context.groupId),
      ]);

    const statsSource = playerWithRelations[0];
    if (!statsSource) {
      return res
        .status(500)
        .json({ message: "Kon spelerstatistieken niet opbouwen." });
    }

    const stats = buildPlayerStats(statsSource, {
      currentSeason,
      championCounts,
    });

    notifyTeamsPlayerChange({ type: "created", name: player.name }).catch(
      (error) => {
        console.error("Teams notificatie mislukt", error);
      }
    );

    res.status(201).json(stats);
  } catch (error: unknown) {
    if (isStoreErrorWithCode(error) && error.code === "P2002") {
      return res.status(409).json({ message: "Deze speler bestaat al." });
    }
    next(error);
  }
});

app.patch("/api/players/:id", async (req, res, next) => {
  const playerId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(playerId)) {
    return res.status(400).json({ message: "Ongeldig speler ID." });
  }

  const { name } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "Naam is verplicht." });
  }

  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }

    const existingPlayer = await store.getPlayer(context.groupId, playerId);

    if (!existingPlayer) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    const updatedPlayer = await store.updatePlayer(context.groupId, playerId, {
      name: name.trim(),
    });

    const [playerWithRelations, currentSeason, championCounts] =
      await Promise.all([
        fetchPlayersWithRelations(context.groupId, playerId),
        getOrCreateSeasonForDate(context.groupId, new Date()),
        getChampionCounts(context.groupId),
      ]);

    const statsSource = playerWithRelations[0];
    if (!statsSource) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    const stats = buildPlayerStats(statsSource, {
      currentSeason,
      championCounts,
    });

    notifyTeamsPlayerChange({
      type: "updated",
      name: updatedPlayer.name,
      previousName: existingPlayer.name,
    }).catch((error) => {
      console.error("Teams notificatie mislukt", error);
    });

    res.json(stats);
  } catch (error: unknown) {
    if (isStoreErrorWithCode(error) && error.code === "P2025") {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }
    if (isStoreErrorWithCode(error) && error.code === "P2002") {
      return res.status(409).json({ message: "Deze speler bestaat al." });
    }
    next(error);
  }
});

app.delete("/api/players/:id", async (req, res, next) => {
  const playerId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(playerId)) {
    return res.status(400).json({ message: "Ongeldig speler ID." });
  }

  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }

    const player = await store.getPlayer(context.groupId, playerId);

    if (!player) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    await store.deletePlayer(context.groupId, playerId);

    notifyTeamsPlayerChange({ type: "deleted", name: player.name }).catch(
      (error) => {
        console.error("Teams notificatie mislukt", error);
      }
    );

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/matches", async (req, res, next) => {
  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }
    const matches = (
      await Promise.all(
        (await store.listMatches(context.groupId)).map((match) =>
          store.hydrateMatch(context.groupId, match)
        )
      )
    ).sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());

    const corrected = await Promise.all(
      matches.map(async (match) => {
        if (match.seasonId) {
          return match;
        }
        const season = await getOrCreateSeasonForDate(context.groupId, match.playedAt);
        return store.hydrateMatch(
          context.groupId,
          await store.updateMatch(context.groupId, match.id, { seasonId: season.id })
        );
      })
    );

    // Compute Elo deltas per match (per season)
    const deltas = computeEloDeltas(corrected);

    const serialized = corrected.map((m) => {
      const base = serializeMatch(m) as any;
      const d = deltas.get(m.id) ?? { playerOneDelta: 0, playerTwoDelta: 0 };
      base.playerOneEloDelta = d.playerOneDelta;
      base.playerTwoEloDelta = d.playerTwoDelta;
      return base;
    });

    res.json(serialized);
  } catch (error) {
    next(error);
  }
});

app.post("/api/matches", async (req, res, next) => {
  const {
    playerOneId,
    playerTwoId,
    playerOnePoints,
    playerTwoPoints,
    playedAt,
  } = req.body ?? {};

  if (
    typeof playerOneId !== "number" ||
    typeof playerTwoId !== "number" ||
    typeof playerOnePoints !== "number" ||
    typeof playerTwoPoints !== "number"
  ) {
    return res.status(400).json({ message: "Ongeldige invoer." });
  }

  if (playerOneId === playerTwoId) {
    return res
      .status(400)
      .json({ message: "Een speler kan niet tegen zichzelf spelen." });
  }

  if (playerOnePoints === playerTwoPoints) {
    return res
      .status(400)
      .json({ message: "Een potje eindigt altijd met een winnaar." });
  }

  if (playerOnePoints < 0 || playerTwoPoints < 0) {
    return res
      .status(400)
      .json({ message: "Scores kunnen niet negatief zijn." });
  }

  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }

    const [playerOne, playerTwo] = await Promise.all([
      store.getPlayer(context.groupId, playerOneId),
      store.getPlayer(context.groupId, playerTwoId),
    ]);

    if (!playerOne || !playerTwo) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    const playedDate = playedAt ? new Date(playedAt) : new Date();
    const season = await getOrCreateSeasonForDate(context.groupId, playedDate);
    const winnerId =
      playerOnePoints > playerTwoPoints ? playerOneId : playerTwoId;

    const match = await store.hydrateMatch(
      context.groupId,
      await store.createMatch(context.groupId, {
        playerOneId,
        playerTwoId,
        playerOnePoints,
        playerTwoPoints,
        winnerId,
        playedAt: playedDate,
        groupId: context.groupId,
        seasonId: season.id,
      })
    );

    notifyTeamsMatchCreated(match).catch((error) => {
      console.error("Teams notificatie mislukt", error);
    });

    res.status(201).json(serializeMatch(match));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/matches/:id", async (req, res, next) => {
  const matchId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(matchId)) {
    return res.status(400).json({ message: "Ongeldig wedstrijd ID." });
  }

  const {
    playerOneId,
    playerTwoId,
    playerOnePoints,
    playerTwoPoints,
    playedAt,
  } = req.body ?? {};

  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }

    const existing = await store.getMatch(context.groupId, matchId);

    if (!existing) {
      return res.status(404).json({ message: "Wedstrijd niet gevonden." });
    }

    const nextPlayerOneId =
      typeof playerOneId === "number" ? playerOneId : existing.playerOneId;
    const nextPlayerTwoId =
      typeof playerTwoId === "number" ? playerTwoId : existing.playerTwoId;
    const nextPlayerOnePoints =
      typeof playerOnePoints === "number"
        ? playerOnePoints
        : existing.playerOnePoints;
    const nextPlayerTwoPoints =
      typeof playerTwoPoints === "number"
        ? playerTwoPoints
        : existing.playerTwoPoints;

    if (nextPlayerOneId === nextPlayerTwoId) {
      return res
        .status(400)
        .json({ message: "Een speler kan niet tegen zichzelf spelen." });
    }

    if (nextPlayerOnePoints === nextPlayerTwoPoints) {
      return res
        .status(400)
        .json({ message: "Een potje eindigt altijd met een winnaar." });
    }

    if (nextPlayerOnePoints < 0 || nextPlayerTwoPoints < 0) {
      return res
        .status(400)
        .json({ message: "Scores kunnen niet negatief zijn." });
    }

    const [playerOne, playerTwo] = await Promise.all([
      store.getPlayer(context.groupId, nextPlayerOneId),
      store.getPlayer(context.groupId, nextPlayerTwoId),
    ]);

    if (!playerOne || !playerTwo) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    const nextPlayedAt = playedAt ? new Date(playedAt) : existing.playedAt;
    const season = await getOrCreateSeasonForDate(context.groupId, nextPlayedAt);
    const winnerId =
      nextPlayerOnePoints > nextPlayerTwoPoints
        ? nextPlayerOneId
        : nextPlayerTwoId;

    const updated = await store.hydrateMatch(
      context.groupId,
      await store.updateMatch(context.groupId, matchId, {
        playerOneId: nextPlayerOneId,
        playerTwoId: nextPlayerTwoId,
        playerOnePoints: nextPlayerOnePoints,
        playerTwoPoints: nextPlayerTwoPoints,
        winnerId,
        playedAt: nextPlayedAt,
        seasonId: season.id,
      })
    );

    notifyTeamsMatchUpdated(updated).catch((error) => {
      console.error("Teams notificatie mislukt", error);
    });

    res.json(serializeMatch(updated));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/matches/:id", async (req, res, next) => {
  const matchId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(matchId)) {
    return res.status(400).json({ message: "Ongeldig wedstrijd ID." });
  }

  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }

    const existingMatch = await store.getMatch(context.groupId, matchId);

    if (!existingMatch) {
      return res.status(404).json({ message: "Wedstrijd niet gevonden." });
    }

    const existing = await store.hydrateMatch(context.groupId, existingMatch);
    await store.deleteMatch(context.groupId, matchId);

    notifyTeamsMatchDeleted(existing).catch((error) => {
      console.error("Teams notificatie mislukt", error);
    });

    res.status(204).end();
  } catch (error) {
    if (isStoreErrorWithCode(error) && error.code === "P2025") {
      return res.status(404).json({ message: "Wedstrijd niet gevonden." });
    }
    next(error);
  }
});

app.get("/api/doubles-matches", async (req, res, next) => {
  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }
    const matches = (
      await Promise.all(
        (await store.listDoublesMatches(context.groupId)).map((match) =>
          store.hydrateDoublesMatch(context.groupId, match)
        )
      )
    ).sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());

    const corrected = await Promise.all(
      matches.map(async (match) => {
        if (match.seasonId) {
          return match;
        }

        const season = await getOrCreateSeasonForDate(context.groupId, match.playedAt);
        return store.hydrateDoublesMatch(
          context.groupId,
          await store.updateDoublesMatch(context.groupId, match.id, { seasonId: season.id })
        );
      })
    );

    res.json(corrected.map(serializeDoublesMatch));
  } catch (error) {
    next(error);
  }
});

app.post("/api/doubles-matches", async (req, res, next) => {
  const {
    teamOnePlayerAId,
    teamOnePlayerBId,
    teamTwoPlayerAId,
    teamTwoPlayerBId,
    teamOnePoints,
    teamTwoPoints,
    playedAt,
  } = req.body ?? {};

  const playerIds = [
    teamOnePlayerAId,
    teamOnePlayerBId,
    teamTwoPlayerAId,
    teamTwoPlayerBId,
  ];

  if (
    typeof teamOnePoints !== "number" ||
    typeof teamTwoPoints !== "number"
  ) {
    return res.status(400).json({ message: "Ongeldige invoer." });
  }

  const validationError = validateDoublesPlayerIds(playerIds);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  if (teamOnePoints === teamTwoPoints) {
    return res
      .status(400)
      .json({ message: "Een potje eindigt altijd met een winnaar." });
  }

  if (teamOnePoints < 0 || teamTwoPoints < 0) {
    return res
      .status(400)
      .json({ message: "Scores kunnen niet negatief zijn." });
  }

  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }

    const players = await store.getPlayersByIds(context.groupId, playerIds);

    if (players.length !== 4) {
      return res.status(404).json({ message: "Een of meer spelers bestaan niet." });
    }

    const playedDate = playedAt ? new Date(playedAt) : new Date();
    const season = await getOrCreateSeasonForDate(context.groupId, playedDate);
    const winnerTeam = teamOnePoints > teamTwoPoints ? 1 : 2;

    const match = await store.hydrateDoublesMatch(
      context.groupId,
      await store.createDoublesMatch(context.groupId, {
        teamOnePlayerAId,
        teamOnePlayerBId,
        teamTwoPlayerAId,
        teamTwoPlayerBId,
        teamOnePoints,
        teamTwoPoints,
        winnerTeam,
        playedAt: playedDate,
        groupId: context.groupId,
        seasonId: season.id,
      })
    );

    res.status(201).json(serializeDoublesMatch(match));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/doubles-matches/:id", async (req, res, next) => {
  const matchId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(matchId)) {
    return res.status(400).json({ message: "Ongeldig wedstrijd ID." });
  }

  const {
    teamOnePlayerAId,
    teamOnePlayerBId,
    teamTwoPlayerAId,
    teamTwoPlayerBId,
    teamOnePoints,
    teamTwoPoints,
    playedAt,
  } = req.body ?? {};

  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }

    const existing = await store.getDoublesMatch(context.groupId, matchId);

    if (!existing) {
      return res.status(404).json({ message: "Wedstrijd niet gevonden." });
    }

    const nextTeamOnePlayerAId =
      typeof teamOnePlayerAId === "number"
        ? teamOnePlayerAId
        : existing.teamOnePlayerAId;
    const nextTeamOnePlayerBId =
      typeof teamOnePlayerBId === "number"
        ? teamOnePlayerBId
        : existing.teamOnePlayerBId;
    const nextTeamTwoPlayerAId =
      typeof teamTwoPlayerAId === "number"
        ? teamTwoPlayerAId
        : existing.teamTwoPlayerAId;
    const nextTeamTwoPlayerBId =
      typeof teamTwoPlayerBId === "number"
        ? teamTwoPlayerBId
        : existing.teamTwoPlayerBId;
    const nextTeamOnePoints =
      typeof teamOnePoints === "number"
        ? teamOnePoints
        : existing.teamOnePoints;
    const nextTeamTwoPoints =
      typeof teamTwoPoints === "number"
        ? teamTwoPoints
        : existing.teamTwoPoints;

    const playerIds = [
      nextTeamOnePlayerAId,
      nextTeamOnePlayerBId,
      nextTeamTwoPlayerAId,
      nextTeamTwoPlayerBId,
    ];

    const validationError = validateDoublesPlayerIds(playerIds);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    if (nextTeamOnePoints === nextTeamTwoPoints) {
      return res
        .status(400)
        .json({ message: "Een potje eindigt altijd met een winnaar." });
    }

    if (nextTeamOnePoints < 0 || nextTeamTwoPoints < 0) {
      return res
        .status(400)
        .json({ message: "Scores kunnen niet negatief zijn." });
    }

    const players = await store.getPlayersByIds(context.groupId, playerIds);

    if (players.length !== 4) {
      return res.status(404).json({ message: "Een of meer spelers bestaan niet." });
    }

    const nextPlayedAt = playedAt ? new Date(playedAt) : existing.playedAt;
    const season = await getOrCreateSeasonForDate(context.groupId, nextPlayedAt);
    const winnerTeam = nextTeamOnePoints > nextTeamTwoPoints ? 1 : 2;

    const updated = await store.hydrateDoublesMatch(
      context.groupId,
      await store.updateDoublesMatch(context.groupId, matchId, {
        teamOnePlayerAId: nextTeamOnePlayerAId,
        teamOnePlayerBId: nextTeamOnePlayerBId,
        teamTwoPlayerAId: nextTeamTwoPlayerAId,
        teamTwoPlayerBId: nextTeamTwoPlayerBId,
        teamOnePoints: nextTeamOnePoints,
        teamTwoPoints: nextTeamTwoPoints,
        winnerTeam,
        playedAt: nextPlayedAt,
        seasonId: season.id,
      })
    );

    res.json(serializeDoublesMatch(updated));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/doubles-matches/:id", async (req, res, next) => {
  const matchId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(matchId)) {
    return res.status(400).json({ message: "Ongeldig wedstrijd ID." });
  }

  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }

    const existing = await store.getDoublesMatch(context.groupId, matchId);

    if (!existing) {
      return res.status(404).json({ message: "Wedstrijd niet gevonden." });
    }

    await store.deleteDoublesMatch(context.groupId, matchId);

    res.status(204).end();
  } catch (error) {
    if (isStoreErrorWithCode(error) && error.code === "P2025") {
      return res.status(404).json({ message: "Wedstrijd niet gevonden." });
    }
    next(error);
  }
});

app.get("/api/seasons", async (req, res, next) => {
  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }
    await ensurePastSeasonChampions();
    const [seasons, currentSeason] = await Promise.all([
      store.listSeasonSummaries(context.groupId),
      getOrCreateSeasonForDate(context.groupId, new Date()),
    ]);

    const now = new Date();

    const seasonPayload = await Promise.all(
      seasons.map(async (season) => {
        const standings = calculateSeasonStandings(season.matches);
        let championPayload = season.champion
          ? { id: season.champion.id, name: season.champion.name }
          : null;

        if (!championPayload && season.endDate < now && standings.length) {
          const championId = standings[0].player.id;
          championPayload = standings[0].player;
          if (season.championId == null || season.championId !== championId) {
            await store.updateSeason(context.groupId, season.id, { championId });
          }
        }

        return {
          id: season.id,
          name: season.name,
          startDate: season.startDate.toISOString(),
          endDate: season.endDate.toISOString(),
          matches: season.matches.length,
          champion: championPayload,
          standings: standings.map((entry) => ({
            player: entry.player,
            wins: entry.wins,
            losses: entry.losses,
            matches: entry.matches,
            pointsFor: entry.pointsFor,
            pointsAgainst: entry.pointsAgainst,
            winRate: entry.winRate,
            // Elo rating for season
            rating: entry.rating,
            pointDifferential: entry.pointDifferential,
          })),
        };
      })
    );

    res.json({
      currentSeasonId: currentSeason.id,
      seasons: seasonPayload,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/recommendations", async (req, res, next) => {
  try {
    const context = await getRequestContext(req as AuthedRequest, res);
    if (!context) {
      return;
    }
    const result = await buildMatchRecommendations(context.groupId);
    res.json({
      generatedAt: new Date().toISOString(),
      season: result.season,
      recommendations: result.recommendations,
    });
  } catch (error) {
    next(error);
  }
});

// Serve static files from the dist directory after API routes.
app.use(express.static(distDir));

// Handle SPA routing - send all non-API requests to index.html.
app.get(/^(?!\/api\/)/, (_req, res) => {
  res.sendFile("index.html", { root: distDir });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ message: "Er ging iets mis." });
});

const start = async () => {
  try {
    const removedDuplicates = await deduplicateSeasons();
    if (removedDuplicates > 0) {
      console.log(
        `Seizoenen opgeschoond: ${removedDuplicates} dubbele records verwijderd.`
      );
    }

    app.listen(PORT, () => {
      console.log(`Pingpong API draait op http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Kon seizoensintegriteit niet waarborgen bij opstarten.", error);
    process.exit(1);
  }
};

start();
