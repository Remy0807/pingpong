import type { Match } from "../types";

export type MatchBadgeTone = "axoft" | "emerald" | "amber" | "rose";

export type MatchBadge = {
  id: "close-game" | "blowout" | "rematch" | "upset";
  label: string;
  tone: MatchBadgeTone;
};

export type MatchInsight = {
  isCloseGame: boolean;
  isBlowout: boolean;
  isRematch: boolean;
  isUpset: boolean;
  upsetDiff: number | null;
  badges: MatchBadge[];
};

const BASE_RATING = 1000;
const ELO_K = 32;
const UPSET_THRESHOLD = 90;
const REMATCH_WINDOW_MS = 1000 * 60 * 60 * 24 * 21;

const getPairKey = (a: number, b: number) => {
  const [min, max] = a < b ? [a, b] : [b, a];
  return `${min}-${max}`;
};

const getExpectedScore = (ratingA: number, ratingB: number) =>
  1 / (1 + 10 ** ((ratingB - ratingA) / 400));

export const getRivalryPath = (playerAId: number, playerBId: number) => {
  const [minId, maxId] =
    playerAId < playerBId ? [playerAId, playerBId] : [playerBId, playerAId];
  return `/rivalries/${minId}/${maxId}`;
};

export const isBlowoutMatch = (match: Match) =>
  (match.playerOnePoints === 11 && match.playerTwoPoints === 0) ||
  (match.playerOnePoints === 0 && match.playerTwoPoints === 11);

export const isCloseGameMatch = (match: Match) => {
  const winnerPoints = Math.max(match.playerOnePoints, match.playerTwoPoints);
  const loserPoints = Math.min(match.playerOnePoints, match.playerTwoPoints);
  return winnerPoints >= 11 && winnerPoints - loserPoints === 2;
};

const buildUpsetMap = (matches: Match[]) => {
  const result = new Map<number, { isUpset: boolean; diff: number | null }>();

  const bySeason = new Map<number, Match[]>();
  matches.forEach((match) => {
    const seasonId = match.season?.id ?? 0;
    const group = bySeason.get(seasonId) ?? [];
    group.push(match);
    bySeason.set(seasonId, group);
  });

  bySeason.forEach((seasonMatches) => {
    const sorted = [...seasonMatches].sort(
      (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
    );
    const ratingMap = new Map<number, number>();

    sorted.forEach((match) => {
      const ratingOne = ratingMap.get(match.playerOneId) ?? BASE_RATING;
      const ratingTwo = ratingMap.get(match.playerTwoId) ?? BASE_RATING;

      const higherRatedId =
        ratingOne === ratingTwo
          ? null
          : ratingOne > ratingTwo
            ? match.playerOneId
            : match.playerTwoId;
      const diff = Math.abs(ratingOne - ratingTwo);
      const isUpset =
        higherRatedId != null &&
        match.winnerId !== higherRatedId &&
        diff >= UPSET_THRESHOLD;

      result.set(match.id, { isUpset, diff: isUpset ? diff : null });

      const expectedOne = getExpectedScore(ratingOne, ratingTwo);
      const expectedTwo = 1 - expectedOne;
      const scoreOne = match.winnerId === match.playerOneId ? 1 : 0;
      const scoreTwo = 1 - scoreOne;
      const nextOne = Math.round(ratingOne + ELO_K * (scoreOne - expectedOne));
      const nextTwo = Math.round(ratingTwo + ELO_K * (scoreTwo - expectedTwo));

      ratingMap.set(match.playerOneId, nextOne);
      ratingMap.set(match.playerTwoId, nextTwo);
    });
  });

  return result;
};

export const buildMatchInsights = (matches: Match[]) => {
  const insights = new Map<number, MatchInsight>();
  const upsetMap = buildUpsetMap(matches);
  const lastPlayedByPair = new Map<string, string>();

  const sorted = [...matches].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
  );

  sorted.forEach((match) => {
    const pairKey = getPairKey(match.playerOneId, match.playerTwoId);
    const previousPlayedAt = lastPlayedByPair.get(pairKey);
    const isRematch =
      previousPlayedAt !== undefined &&
      new Date(match.playedAt).getTime() -
        new Date(previousPlayedAt).getTime() <=
        REMATCH_WINDOW_MS;
    const isCloseGame = isCloseGameMatch(match);
    const isBlowout = isBlowoutMatch(match);
    const upsetData = upsetMap.get(match.id) ?? { isUpset: false, diff: null };

    const badges: MatchBadge[] = [];
    if (isCloseGame) {
      badges.push({ id: "close-game", label: "Close game", tone: "axoft" });
    }
    if (isBlowout) {
      badges.push({ id: "blowout", label: "Blowout", tone: "rose" });
    }
    if (isRematch) {
      badges.push({ id: "rematch", label: "Rematch", tone: "emerald" });
    }
    if (upsetData.isUpset && upsetData.diff != null) {
      badges.push({
        id: "upset",
        label: `Upset +${upsetData.diff}`,
        tone: "amber",
      });
    }

    insights.set(match.id, {
      isCloseGame,
      isBlowout,
      isRematch,
      isUpset: upsetData.isUpset,
      upsetDiff: upsetData.diff,
      badges,
    });

    lastPlayedByPair.set(pairKey, match.playedAt);
  });

  return insights;
};
