import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const seasonCache = new Map<string, number>();

const getSeasonKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;

const getSeasonBoundaries = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const buildSeasonName = (date: Date) =>
  `Seizoen ${date.toLocaleString("nl-NL", { month: "long" })} ${date.getFullYear()}`.replace(
    /^\w/,
    (char) => char.toUpperCase()
  );

async function getSeasonIdForDate(date: Date) {
  const key = getSeasonKey(date);
  if (seasonCache.has(key)) {
    return seasonCache.get(key)!;
  }

  const { start, end } = getSeasonBoundaries(date);
  const existing = await prisma.season.findFirst({
    where: {
      startDate: { lte: date },
      endDate: { gte: date }
    }
  });

  if (existing) {
    seasonCache.set(key, existing.id);
    return existing.id;
  }

  const season = await prisma.season.create({
    data: {
      name: buildSeasonName(date),
      startDate: start,
      endDate: end
    }
  });

  seasonCache.set(key, season.id);
  return season.id;
}

async function main() {
  console.log("Seeding database with demo data...");

  await prisma.match.deleteMany();
  await prisma.season.deleteMany();
  await prisma.player.deleteMany();

  const players = await Promise.all(
    ["Remy", "Sanne", "Koen", "Lotte", "Ahmed", "Lisa"].map((name) =>
      prisma.player.create({
        data: { name }
      })
    )
  );

  const [remy, sanne, koen, lotte, ahmed, lisa] = players;

  const fixtures = [
    { a: remy, b: sanne, score: [11, 7] },
    { a: sanne, b: koen, score: [11, 9] },
    { a: remy, b: koen, score: [9, 11] },
    { a: lotte, b: lisa, score: [11, 5] },
    { a: ahmed, b: remy, score: [6, 11] },
    { a: lisa, b: sanne, score: [11, 8] },
    { a: koen, b: lotte, score: [10, 12] },
    { a: ahmed, b: sanne, score: [11, 4] }
  ];

  for (const fixture of fixtures) {
    const [playerOnePoints, playerTwoPoints] = fixture.score;
    const winner = playerOnePoints > playerTwoPoints ? fixture.a : fixture.b;
    const playedAt = new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 10);
    const seasonId = await getSeasonIdForDate(playedAt);

    await prisma.match.create({
      data: {
        playerOneId: fixture.a.id,
        playerTwoId: fixture.b.id,
        playerOnePoints,
        playerTwoPoints,
        winnerId: winner.id,
        playedAt,
        seasonId
      }
    });
  }

  console.log("Database seeded!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
