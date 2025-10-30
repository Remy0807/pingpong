import "dotenv/config";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT) || 4000;
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;

type PrismaErrorWithCode = { code: string };

const isPrismaErrorWithCode = (
  error: unknown
): error is PrismaErrorWithCode => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
};

app.use(cors());
app.use(express.json());

type PlayerWithRelations = Awaited<
  ReturnType<typeof fetchPlayersWithRelations>
>[number];

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

async function getOrCreateSeasonForDate(date: Date) {
  const { start, end } = getSeasonBoundaries(date);
  const existing = await prisma.season.findFirst({
    where: {
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.season.create({
    data: {
      name: `Seizoen ${buildSeasonName(date)}`,
      startDate: start,
      endDate: end,
    },
  });
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
  const badges: string[] = [];

  if (currentStreak >= 3) {
    badges.push("In vorm");
  }
  if (seasonMatches.length >= 3 && seasonLosses === 0) {
    badges.push("Perfecte maand");
  }
  if (
    seasonMatches.length >= 5 &&
    seasonWins / (seasonMatches.length || 1) >= 0.75
  ) {
    badges.push("Dominantie");
  }
  if (seasonMatches.length >= 10) {
    badges.push("Marathonspeler");
  }
  if (longestStreak >= 5) {
    badges.push("Winmachine");
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

async function fetchPlayersWithRelations(playerId?: number) {
  return prisma.player.findMany({
    where: playerId ? { id: playerId } : undefined,
    orderBy: { name: "asc" },
    include: {
      matchesAsPlayerOne: true,
      matchesAsPlayerTwo: true,
      matchesWon: true,
    },
  });
}

const matchInclude = {
  playerOne: true,
  playerTwo: true,
  winner: true,
  season: true,
} as const;

type MatchWithRelations = Prisma.MatchGetPayload<{
  include: typeof matchInclude;
}>;

const getChampionCounts = async () => {
  const championGroups = await prisma.season.groupBy({
    by: ["championId"],
    _count: {
      championId: true,
    },
    where: {
      championId: {
        not: null,
      },
    },
  });

  const map = new Map<number, number>();
  championGroups.forEach((group) => {
    if (group.championId != null) {
      map.set(group.championId, group._count.championId);
    }
  });

  return map;
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
  const pastSeasons = await prisma.season.findMany({
    where: { endDate: { lt: now } },
    include: {
      matches: {
        include: matchInclude,
      },
    },
  });

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
      await prisma.season.update({
        where: { id: season.id },
        data: { championId },
      });
    })
  );
};

const getLeaderboardSnapshot = async () => {
  const [players, currentSeason, championCounts] = await Promise.all([
    fetchPlayersWithRelations(),
    getOrCreateSeasonForDate(new Date()),
    getChampionCounts(),
  ]);

  return players
    .map((player) =>
      buildPlayerStats(player, { currentSeason, championCounts })
    )
    .sort((a, b) => {
      if (b.winRate === a.winRate) {
        return b.pointDifferential - a.pointDifferential;
      }
      return b.winRate - a.winRate;
    });
};

const buildAdaptiveCard = (body: unknown[], actions: unknown[] = []) => ({
  $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
  type: "AdaptiveCard",
  version: "1.4",
  body,
  actions,
});

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
    const leaderboard = await getLeaderboardSnapshot();
    const body: unknown[] = [
      {
        type: "TextBlock",
        text: "Nieuwe wedstrijd geregistreerd",
        weight: "Bolder",
        size: "Large",
      },
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: 2,
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
                text: `Seizoen: ${match.season?.name ?? "Onbekend"}`,
                isSubtle: true,
                spacing: "Small",
                wrap: true,
              },
              {
                type: "TextBlock",
                text: `Winnaar: ${match.winner.name}`,
                wrap: true,
              },
            ],
          },
          {
            type: "Column",
            width: 1,
            items: [
              {
                type: "TextBlock",
                text: "Score",
                weight: "Bolder",
                horizontalAlignment: "Center",
              },
              {
                type: "TextBlock",
                text: `${match.playerOnePoints} - ${match.playerTwoPoints}`,
                size: "ExtraLarge",
                weight: "Bolder",
                horizontalAlignment: "Center",
              },
            ],
            verticalContentAlignment: "Center",
          },
        ],
      },
    ];

    const topFive = leaderboard.slice(0, 5);
    if (topFive.length) {
      body.push({
        type: "TextBlock",
        text: "Actuele top 5",
        weight: "Bolder",
        spacing: "Medium",
      });
      body.push({
        type: "FactSet",
        facts: topFive.map((entry, index) => {
          const winPercentage = entry.winRate
            ? Math.round(entry.winRate * 100)
            : 0;
          return {
            title: `${index + 1}. ${entry.player.name}`,
            value: `${entry.wins}W/${entry.losses}L (${winPercentage}%)`,
          };
        }),
      });
    }

    const badgeHolders = leaderboard
      .filter((entry) => entry.badges.length > 0)
      .slice(0, 3);
    if (badgeHolders.length) {
      body.push({
        type: "TextBlock",
        text: "Spelers in vorm",
        weight: "Bolder",
        spacing: "Medium",
      });
      body.push({
        type: "TextBlock",
        text: badgeHolders
          .map((entry) => `${entry.player.name}: ${entry.badges.join(", ")}`)
          .join("\n"),
        wrap: true,
      });
    }

    const streakMilestones = leaderboard.filter(
      (entry) => entry.justReachedStreakFive
    );
    if (streakMilestones.length) {
      body.push({
        type: "TextBlock",
        text: "Streak alert",
        weight: "Bolder",
        spacing: "Medium",
      });
      body.push({
        type: "TextBlock",
        text: streakMilestones
          .map(
            (entry) =>
              `${entry.player.name} staat op een winstreak van ${entry.currentStreak}!`
          )
          .join("\n"),
        wrap: true,
      });
    }

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
    const leaderboard = await getLeaderboardSnapshot();
    const body: unknown[] = [
      {
        type: "TextBlock",
        text: "Wedstrijd bijgewerkt",
        weight: "Bolder",
        size: "Large",
      },
      {
        type: "TextBlock",
        text: `${match.playerOne.name} vs ${match.playerTwo.name}`,
        weight: "Bolder",
        size: "Medium",
        wrap: true,
      },
      {
        type: "TextBlock",
        text: `Score: ${match.playerOnePoints}-${match.playerTwoPoints}`,
        wrap: true,
      },
      {
        type: "TextBlock",
        text: `Winnaar: ${match.winner.name}`,
        wrap: true,
      },
      {
        type: "TextBlock",
        text: `Seizoen: ${match.season?.name ?? "Onbekend"}`,
        isSubtle: true,
        wrap: true,
      },
    ];

    const topThree = leaderboard.slice(0, 3);
    if (topThree.length) {
      body.push({
        type: "TextBlock",
        text: "Top 3 na wijziging",
        weight: "Bolder",
        spacing: "Medium",
      });
      body.push({
        type: "FactSet",
        facts: topThree.map((entry, index) => {
          const winPercentage = entry.winRate
            ? Math.round(entry.winRate * 100)
            : 0;
          return {
            title: `${index + 1}. ${entry.player.name}`,
            value: `${entry.wins}W/${entry.losses}L (${winPercentage}%)`,
          };
        }),
      });
    }

    const streakMilestones = leaderboard.filter(
      (entry) => entry.justReachedStreakFive
    );
    if (streakMilestones.length) {
      body.push({
        type: "TextBlock",
        text: "Streak alert",
        weight: "Bolder",
        spacing: "Medium",
      });
      body.push({
        type: "TextBlock",
        text: streakMilestones
          .map(
            (entry) =>
              `${entry.player.name} staat op een winstreak van ${entry.currentStreak}!`
          )
          .join("\n"),
        wrap: true,
      });
    }

    await sendTeamsCard(buildAdaptiveCard(body));
  } catch (error) {
    console.error("Kon Teams niet notificeren", error);
  }
};

const notifyTeamsMatchDeleted = async (match: MatchWithRelations) => {
  try {
    const leaderboard = await getLeaderboardSnapshot();
    const body: unknown[] = [
      {
        type: "TextBlock",
        text: "Wedstrijd verwijderd",
        weight: "Bolder",
        size: "Large",
      },
      {
        type: "TextBlock",
        text: `${match.playerOne.name} vs ${match.playerTwo.name}`,
        weight: "Bolder",
        size: "Medium",
        wrap: true,
      },
      {
        type: "TextBlock",
        text: `Score was: ${match.playerOnePoints}-${match.playerTwoPoints}`,
        wrap: true,
      },
      {
        type: "TextBlock",
        text: `Winnaar was: ${match.winner.name}`,
        wrap: true,
      },
    ];

    const topThree = leaderboard.slice(0, 3);
    if (topThree.length) {
      body.push({
        type: "TextBlock",
        text: "Top 3 na verwijdering",
        weight: "Bolder",
        spacing: "Medium",
      });
      body.push({
        type: "FactSet",
        facts: topThree.map((entry, index) => {
          const winPercentage = entry.winRate
            ? Math.round(entry.winRate * 100)
            : 0;
          return {
            title: `${index + 1}. ${entry.player.name}`,
            value: `${entry.wins}W/${entry.losses}L (${winPercentage}%)`,
          };
        }),
      });
    }

    await sendTeamsCard(buildAdaptiveCard(body));
  } catch (error) {
    console.error("Kon Teams niet notificeren", error);
  }
};

const serializeMatch = (match: MatchWithRelations) => ({
  ...match,
  playedAt: match.playedAt.toISOString(),
  playerOne: {
    ...match.playerOne,
    createdAt: match.playerOne.createdAt.toISOString(),
    updatedAt: match.playerOne.updatedAt.toISOString(),
  },
  playerTwo: {
    ...match.playerTwo,
    createdAt: match.playerTwo.createdAt.toISOString(),
    updatedAt: match.playerTwo.updatedAt.toISOString(),
  },
  winner: {
    ...match.winner,
    createdAt: match.winner.createdAt.toISOString(),
    updatedAt: match.winner.updatedAt.toISOString(),
  },
  season: match.season
    ? {
        id: match.season.id,
        name: match.season.name,
        startDate: match.season.startDate.toISOString(),
        endDate: match.season.endDate.toISOString(),
      }
    : null,
  createdAt: match.createdAt.toISOString(),
  updatedAt: match.updatedAt.toISOString(),
});

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

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/players", async (_req, res, next) => {
  try {
    await ensurePastSeasonChampions();
    const [players, currentSeason, championCounts] = await Promise.all([
      fetchPlayersWithRelations(),
      getOrCreateSeasonForDate(new Date()),
      getChampionCounts(),
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
    const player = await prisma.player.create({
      data: { name: name.trim() },
    });

    const [playerWithRelations, currentSeason, championCounts] =
      await Promise.all([
        fetchPlayersWithRelations(player.id),
        getOrCreateSeasonForDate(new Date()),
        getChampionCounts(),
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
    if (isPrismaErrorWithCode(error) && error.code === "P2002") {
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
    const existingPlayer = await prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!existingPlayer) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    const updatedPlayer = await prisma.player.update({
      where: { id: playerId },
      data: { name: name.trim() },
    });

    const [playerWithRelations, currentSeason, championCounts] =
      await Promise.all([
        fetchPlayersWithRelations(playerId),
        getOrCreateSeasonForDate(new Date()),
        getChampionCounts(),
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
    if (isPrismaErrorWithCode(error) && error.code === "P2025") {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }
    if (isPrismaErrorWithCode(error) && error.code === "P2002") {
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
    const player = await prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    await prisma.$transaction([
      prisma.match.deleteMany({
        where: {
          OR: [{ playerOneId: playerId }, { playerTwoId: playerId }],
        },
      }),
      prisma.player.delete({ where: { id: playerId } }),
    ]);

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

app.get("/api/matches", async (_req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { playedAt: "desc" },
      include: matchInclude,
    });

    const corrected = await Promise.all(
      matches.map(async (match) => {
        if (match.seasonId) {
          return match;
        }
        const season = await getOrCreateSeasonForDate(match.playedAt);
        return prisma.match.update({
          where: { id: match.id },
          data: { seasonId: season.id },
          include: matchInclude,
        });
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
    const [playerOne, playerTwo] = await Promise.all([
      prisma.player.findUnique({ where: { id: playerOneId } }),
      prisma.player.findUnique({ where: { id: playerTwoId } }),
    ]);

    if (!playerOne || !playerTwo) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    const playedDate = playedAt ? new Date(playedAt) : new Date();
    const season = await getOrCreateSeasonForDate(playedDate);
    const winnerId =
      playerOnePoints > playerTwoPoints ? playerOneId : playerTwoId;

    const match = await prisma.match.create({
      data: {
        playerOneId,
        playerTwoId,
        playerOnePoints,
        playerTwoPoints,
        winnerId,
        playedAt: playedDate,
        seasonId: season.id,
      },
      include: matchInclude,
    });

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
    const existing = await prisma.match.findUnique({
      where: { id: matchId },
    });

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
      prisma.player.findUnique({ where: { id: nextPlayerOneId } }),
      prisma.player.findUnique({ where: { id: nextPlayerTwoId } }),
    ]);

    if (!playerOne || !playerTwo) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    const nextPlayedAt = playedAt ? new Date(playedAt) : existing.playedAt;
    const season = await getOrCreateSeasonForDate(nextPlayedAt);
    const winnerId =
      nextPlayerOnePoints > nextPlayerTwoPoints
        ? nextPlayerOneId
        : nextPlayerTwoId;

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: {
        playerOneId: nextPlayerOneId,
        playerTwoId: nextPlayerTwoId,
        playerOnePoints: nextPlayerOnePoints,
        playerTwoPoints: nextPlayerTwoPoints,
        winnerId,
        playedAt: nextPlayedAt,
        seasonId: season.id,
      },
      include: matchInclude,
    });

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
    const existing = await prisma.match.findUnique({
      where: { id: matchId },
      include: matchInclude,
    });

    if (!existing) {
      return res.status(404).json({ message: "Wedstrijd niet gevonden." });
    }

    await prisma.match.delete({
      where: { id: matchId },
    });

    notifyTeamsMatchDeleted(existing).catch((error) => {
      console.error("Teams notificatie mislukt", error);
    });

    res.status(204).end();
  } catch (error) {
    if (isPrismaErrorWithCode(error) && error.code === "P2025") {
      return res.status(404).json({ message: "Wedstrijd niet gevonden." });
    }
    next(error);
  }
});

app.get("/api/seasons", async (_req, res, next) => {
  try {
    await ensurePastSeasonChampions();
    const [seasons, currentSeason] = await Promise.all([
      prisma.season.findMany({
        orderBy: { startDate: "desc" },
        include: {
          matches: {
            include: matchInclude,
          },
          champion: true,
        },
      }),
      getOrCreateSeasonForDate(new Date()),
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
            await prisma.season.update({
              where: { id: season.id },
              data: { championId },
            });
          }
        }

        return {
          id: season.id,
          name: season.name,
          startDate: season.startDate.toISOString(),
          endDate: season.endDate.toISOString(),
          matches: season.matches.length,
          champion: championPayload,
          standings: standings.slice(0, 10).map((entry) => ({
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

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ message: "Er ging iets mis." });
});

app.listen(PORT, () => {
  console.log(`Pingpong API draait op http://localhost:${PORT}`);
});
