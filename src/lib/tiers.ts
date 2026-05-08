import type { Match } from "../types";

export type TierDefinition = {
  key: string;
  label: string;
  minRating: number;
  maxRating: number | null;
  accentClass: string;
  description: string;
};

export const tierLadder: TierDefinition[] = [
  {
    key: "bronze",
    label: "Bronze",
    minRating: 0,
    maxRating: 999,
    accentClass: "border-amber-900/40 bg-amber-500/10 text-amber-100",
    description: "Startniveau voor nieuwe spelers.",
  },
  {
    key: "silver",
    label: "Silver",
    minRating: 1000,
    maxRating: 1149,
    accentClass: "border-slate-300/20 bg-slate-200/10 text-slate-100",
    description: "Vaste basis met een solide winsttempo.",
  },
  {
    key: "gold-i",
    label: "Gold I",
    minRating: 1150,
    maxRating: 1199,
    accentClass: "border-yellow-600/40 bg-yellow-500/10 text-yellow-100",
    description: "Sterke spelers met duidelijke progressie.",
  },
  {
    key: "gold-ii",
    label: "Gold II",
    minRating: 1200,
    maxRating: 1249,
    accentClass: "border-yellow-500/50 bg-yellow-400/10 text-yellow-50",
    description: "Boven de middenmoot en klaar voor de top.",
  },
  {
    key: "platinum",
    label: "Platinum",
    minRating: 1250,
    maxRating: 1399,
    accentClass: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
    description: "Constante resultaten tegen sterke tegenstanders.",
  },
  {
    key: "diamond",
    label: "Diamond",
    minRating: 1400,
    maxRating: 1549,
    accentClass: "border-indigo-400/40 bg-indigo-500/10 text-indigo-100",
    description: "Topniveau met hoge stabiliteit.",
  },
  {
    key: "master",
    label: "Master",
    minRating: 1550,
    maxRating: null,
    accentClass: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100",
    description: "De absolute top van de groep.",
  },
];

export function getTierForRating(rating: number): TierDefinition {
  const tier = [...tierLadder]
    .reverse()
    .find((entry) => rating >= entry.minRating);
  return tier ?? tierLadder[0];
}

export function calculateOverallEloMap(matches: Match[]) {
  const BASE_RATING = 1000;
  const K = 32;
  const ratingMap = new Map<number, number>();

  const sortedMatches = [...matches].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime(),
  );

  const getRating = (playerId: number) => ratingMap.get(playerId) ?? BASE_RATING;

  sortedMatches.forEach((match) => {
    const ratingA = getRating(match.playerOneId);
    const ratingB = getRating(match.playerTwoId);
    const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
    const expectedB = 1 - expectedA;
    const scoreA = match.winnerId === match.playerOneId ? 1 : 0;
    const scoreB = 1 - scoreA;

    ratingMap.set(
      match.playerOneId,
      Math.round(ratingA + K * (scoreA - expectedA)),
    );
    ratingMap.set(
      match.playerTwoId,
      Math.round(ratingB + K * (scoreB - expectedB)),
    );
  });

  return ratingMap;
}
