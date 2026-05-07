import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type AppOptions,
} from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

export type PlayerRecord = {
  id: number;
  name: string;
  normalizedName?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SeasonRecord = {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  championId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MatchRecord = {
  id: number;
  playerOneId: number;
  playerTwoId: number;
  winnerId: number;
  playerOnePoints: number;
  playerTwoPoints: number;
  playedAt: Date;
  seasonId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DoublesMatchRecord = {
  id: number;
  teamOnePlayerAId: number;
  teamOnePlayerBId: number;
  teamTwoPlayerAId: number;
  teamTwoPlayerBId: number;
  teamOnePoints: number;
  teamTwoPoints: number;
  winnerTeam: number;
  playedAt: Date;
  seasonId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlayerWithRelations = PlayerRecord & {
  matchesAsPlayerOne: MatchRecord[];
  matchesAsPlayerTwo: MatchRecord[];
  matchesWon: MatchRecord[];
};

export type MatchWithRelations = MatchRecord & {
  playerOne: PlayerRecord;
  playerTwo: PlayerRecord;
  winner: PlayerRecord;
  season: SeasonRecord | null;
};

export type DoublesMatchWithRelations = DoublesMatchRecord & {
  teamOnePlayerA: PlayerRecord;
  teamOnePlayerB: PlayerRecord;
  teamTwoPlayerA: PlayerRecord;
  teamTwoPlayerB: PlayerRecord;
  season: SeasonRecord | null;
};

export type SeasonWithRelations = SeasonRecord & {
  matches: MatchWithRelations[];
  champion: PlayerRecord | null;
};

export class FirebaseUniqueConstraintError extends Error {
  code = "P2002";
}

export class FirebaseNotFoundError extends Error {
  code = "P2025";
}

const parseServiceAccount = () => {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (encoded) {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    return JSON.parse(raw);
  }

  return null;
};

const initializeFirebase = () => {
  if (getApps().length) {
    return;
  }

  const serviceAccount = parseServiceAccount();
  const options: AppOptions = {
    projectId: process.env.FIREBASE_PROJECT_ID,
  };

  if (serviceAccount) {
    options.credential = cert(serviceAccount);
  } else if (!process.env.FIRESTORE_EMULATOR_HOST) {
    options.credential = applicationDefault();
  }

  initializeApp(options);
};

initializeFirebase();

const firestore = getFirestore();

const toDate = (value: unknown): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  return new Date();
};

const normalizeName = (name: string) => name.trim().toLocaleLowerCase("nl-NL");

const fromPlayerDoc = (doc: QueryDocumentSnapshot<DocumentData>): PlayerRecord => {
  const data = doc.data();
  return {
    id: data.id,
    name: data.name,
    normalizedName: data.normalizedName,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
};

const fromSeasonDoc = (doc: QueryDocumentSnapshot<DocumentData>): SeasonRecord => {
  const data = doc.data();
  return {
    id: data.id,
    name: data.name,
    startDate: toDate(data.startDate),
    endDate: toDate(data.endDate),
    championId: data.championId ?? null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
};

const fromMatchDoc = (doc: QueryDocumentSnapshot<DocumentData>): MatchRecord => {
  const data = doc.data();
  return {
    id: data.id,
    playerOneId: data.playerOneId,
    playerTwoId: data.playerTwoId,
    winnerId: data.winnerId,
    playerOnePoints: data.playerOnePoints,
    playerTwoPoints: data.playerTwoPoints,
    playedAt: toDate(data.playedAt),
    seasonId: data.seasonId ?? null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
};

const fromDoublesMatchDoc = (
  doc: QueryDocumentSnapshot<DocumentData>
): DoublesMatchRecord => {
  const data = doc.data();
  return {
    id: data.id,
    teamOnePlayerAId: data.teamOnePlayerAId,
    teamOnePlayerBId: data.teamOnePlayerBId,
    teamTwoPlayerAId: data.teamTwoPlayerAId,
    teamTwoPlayerBId: data.teamTwoPlayerBId,
    teamOnePoints: data.teamOnePoints,
    teamTwoPoints: data.teamTwoPoints,
    winnerTeam: data.winnerTeam,
    playedAt: toDate(data.playedAt),
    seasonId: data.seasonId ?? null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
};

const sortBy = <T>(items: T[], key: keyof T, direction: "asc" | "desc") => {
  return [...items].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    const leftValue = left instanceof Date ? left.getTime() : left;
    const rightValue = right instanceof Date ? right.getTime() : right;
    if (leftValue === rightValue) return 0;
    const result = leftValue > rightValue ? 1 : -1;
    return direction === "asc" ? result : -result;
  });
};

class FirebaseStore {
  constructor(private readonly db: Firestore) {}

  private collection(name: string) {
    return this.db.collection(name);
  }

  private async nextId(name: string) {
    const ref = this.collection("metadata").doc(`counter-${name}`);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const next = ((snapshot.data()?.value as number | undefined) ?? 0) + 1;
      transaction.set(ref, { value: next }, { merge: true });
      return next;
    });
  }

  async listPlayers() {
    const snapshot = await this.collection("players").get();
    return sortBy(snapshot.docs.map(fromPlayerDoc), "name", "asc");
  }

  async getPlayer(id: number) {
    const doc = await this.collection("players").doc(String(id)).get();
    return doc.exists ? fromPlayerDoc(doc as QueryDocumentSnapshot<DocumentData>) : null;
  }

  async getPlayersByIds(ids: number[]) {
    const players = await Promise.all(ids.map((id) => this.getPlayer(id)));
    return players.filter((player): player is PlayerRecord => Boolean(player));
  }

  async createPlayer(name: string) {
    const trimmedName = name.trim();
    const normalizedName = normalizeName(trimmedName);
    const existing = await this.collection("players")
      .where("normalizedName", "==", normalizedName)
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new FirebaseUniqueConstraintError("Player name must be unique.");
    }

    const id = await this.nextId("players");
    const now = new Date();
    const player: PlayerRecord = {
      id,
      name: trimmedName,
      normalizedName,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection("players").doc(String(id)).set(player);
    return player;
  }

  async updatePlayer(id: number, data: { name: string }) {
    const existing = await this.getPlayer(id);
    if (!existing) {
      throw new FirebaseNotFoundError("Player not found.");
    }

    const trimmedName = data.name.trim();
    const normalizedName = normalizeName(trimmedName);
    const duplicate = await this.collection("players")
      .where("normalizedName", "==", normalizedName)
      .limit(1)
      .get();

    const duplicatePlayer = duplicate.docs[0]
      ? fromPlayerDoc(duplicate.docs[0])
      : null;
    if (duplicatePlayer && duplicatePlayer.id !== id) {
      throw new FirebaseUniqueConstraintError("Player name must be unique.");
    }

    const updated: PlayerRecord = {
      ...existing,
      name: trimmedName,
      normalizedName,
      updatedAt: new Date(),
    };
    await this.collection("players").doc(String(id)).set(updated);
    return updated;
  }

  async deletePlayer(id: number) {
    const existing = await this.getPlayer(id);
    if (!existing) {
      throw new FirebaseNotFoundError("Player not found.");
    }

    const [matches, doublesMatches] = await Promise.all([
      this.listMatches(),
      this.listDoublesMatches(),
    ]);
    const batch = this.db.batch();
    matches
      .filter((match) => match.playerOneId === id || match.playerTwoId === id)
      .forEach((match) => {
        batch.delete(this.collection("matches").doc(String(match.id)));
      });
    doublesMatches
      .filter((match) =>
        [
          match.teamOnePlayerAId,
          match.teamOnePlayerBId,
          match.teamTwoPlayerAId,
          match.teamTwoPlayerBId,
        ].includes(id)
      )
      .forEach((match) => {
        batch.delete(this.collection("doublesMatches").doc(String(match.id)));
      });
    batch.delete(this.collection("players").doc(String(id)));
    await batch.commit();
    return existing;
  }

  async listSeasons() {
    const snapshot = await this.collection("seasons").get();
    return snapshot.docs.map(fromSeasonDoc);
  }

  async getSeason(id: number | null | undefined) {
    if (id == null) {
      return null;
    }
    const doc = await this.collection("seasons").doc(String(id)).get();
    return doc.exists ? fromSeasonDoc(doc as QueryDocumentSnapshot<DocumentData>) : null;
  }

  async findSeasonForDate(date: Date) {
    const seasons = await this.listSeasons();
    return (
      seasons.find(
        (season) => season.startDate <= date && season.endDate >= date
      ) ?? null
    );
  }

  async findSeasonByBoundaries(startDate: Date, endDate: Date) {
    const seasons = await this.listSeasons();
    return (
      seasons.find(
        (season) =>
          season.startDate.getTime() === startDate.getTime() &&
          season.endDate.getTime() === endDate.getTime()
      ) ?? null
    );
  }

  async createSeason(data: {
    name: string;
    startDate: Date;
    endDate: Date;
    championId?: number | null;
  }) {
    const existing = await this.findSeasonByBoundaries(data.startDate, data.endDate);
    if (existing) {
      throw new FirebaseUniqueConstraintError("Season boundaries must be unique.");
    }

    const id = await this.nextId("seasons");
    const now = new Date();
    const season: SeasonRecord = {
      id,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      championId: data.championId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection("seasons").doc(String(id)).set(season);
    return season;
  }

  async updateSeason(id: number, data: Partial<SeasonRecord>) {
    const existing = await this.getSeason(id);
    if (!existing) {
      throw new FirebaseNotFoundError("Season not found.");
    }

    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    await this.collection("seasons").doc(String(id)).set(updated);
    return updated;
  }

  async listMatches() {
    const snapshot = await this.collection("matches").get();
    return snapshot.docs.map(fromMatchDoc);
  }

  async getMatch(id: number) {
    const doc = await this.collection("matches").doc(String(id)).get();
    return doc.exists ? fromMatchDoc(doc as QueryDocumentSnapshot<DocumentData>) : null;
  }

  async createMatch(data: Omit<MatchRecord, "id" | "createdAt" | "updatedAt">) {
    const id = await this.nextId("matches");
    const now = new Date();
    const match: MatchRecord = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection("matches").doc(String(id)).set(match);
    return match;
  }

  async updateMatch(id: number, data: Partial<MatchRecord>) {
    const existing = await this.getMatch(id);
    if (!existing) {
      throw new FirebaseNotFoundError("Match not found.");
    }
    const updated: MatchRecord = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    await this.collection("matches").doc(String(id)).set(updated);
    return updated;
  }

  async deleteMatch(id: number) {
    const existing = await this.getMatch(id);
    if (!existing) {
      throw new FirebaseNotFoundError("Match not found.");
    }
    await this.collection("matches").doc(String(id)).delete();
    return existing;
  }

  async listDoublesMatches() {
    const snapshot = await this.collection("doublesMatches").get();
    return snapshot.docs.map(fromDoublesMatchDoc);
  }

  async getDoublesMatch(id: number) {
    const doc = await this.collection("doublesMatches").doc(String(id)).get();
    return doc.exists
      ? fromDoublesMatchDoc(doc as QueryDocumentSnapshot<DocumentData>)
      : null;
  }

  async createDoublesMatch(
    data: Omit<DoublesMatchRecord, "id" | "createdAt" | "updatedAt">
  ) {
    const id = await this.nextId("doublesMatches");
    const now = new Date();
    const match: DoublesMatchRecord = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection("doublesMatches").doc(String(id)).set(match);
    return match;
  }

  async updateDoublesMatch(id: number, data: Partial<DoublesMatchRecord>) {
    const existing = await this.getDoublesMatch(id);
    if (!existing) {
      throw new FirebaseNotFoundError("Doubles match not found.");
    }
    const updated: DoublesMatchRecord = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    await this.collection("doublesMatches").doc(String(id)).set(updated);
    return updated;
  }

  async deleteDoublesMatch(id: number) {
    const existing = await this.getDoublesMatch(id);
    if (!existing) {
      throw new FirebaseNotFoundError("Doubles match not found.");
    }
    await this.collection("doublesMatches").doc(String(id)).delete();
    return existing;
  }

  async hydrateMatch(match: MatchRecord): Promise<MatchWithRelations> {
    const [playerOne, playerTwo, winner, season] = await Promise.all([
      this.getPlayer(match.playerOneId),
      this.getPlayer(match.playerTwoId),
      this.getPlayer(match.winnerId),
      this.getSeason(match.seasonId),
    ]);

    if (!playerOne || !playerTwo || !winner) {
      throw new Error(`Match ${match.id} references missing player records.`);
    }

    return {
      ...match,
      playerOne,
      playerTwo,
      winner,
      season,
    };
  }

  async hydrateDoublesMatch(
    match: DoublesMatchRecord
  ): Promise<DoublesMatchWithRelations> {
    const [
      teamOnePlayerA,
      teamOnePlayerB,
      teamTwoPlayerA,
      teamTwoPlayerB,
      season,
    ] = await Promise.all([
      this.getPlayer(match.teamOnePlayerAId),
      this.getPlayer(match.teamOnePlayerBId),
      this.getPlayer(match.teamTwoPlayerAId),
      this.getPlayer(match.teamTwoPlayerBId),
      this.getSeason(match.seasonId),
    ]);

    if (!teamOnePlayerA || !teamOnePlayerB || !teamTwoPlayerA || !teamTwoPlayerB) {
      throw new Error(`Doubles match ${match.id} references missing player records.`);
    }

    return {
      ...match,
      teamOnePlayerA,
      teamOnePlayerB,
      teamTwoPlayerA,
      teamTwoPlayerB,
      season,
    };
  }

  async fetchPlayersWithRelations(playerId?: number): Promise<PlayerWithRelations[]> {
    const [players, matches] = await Promise.all([
      this.listPlayers(),
      this.listMatches(),
    ]);
    return players
      .filter((player) => (playerId ? player.id === playerId : true))
      .map((player) => ({
        ...player,
        matchesAsPlayerOne: matches.filter((match) => match.playerOneId === player.id),
        matchesAsPlayerTwo: matches.filter((match) => match.playerTwoId === player.id),
        matchesWon: matches.filter((match) => match.winnerId === player.id),
      }));
  }

  async getChampionCounts() {
    const seasons = await this.listSeasons();
    const map = new Map<number, number>();
    seasons.forEach((season) => {
      if (season.championId != null) {
        map.set(season.championId, (map.get(season.championId) ?? 0) + 1);
      }
    });
    return map;
  }

  async listSeasonSummaries(): Promise<SeasonWithRelations[]> {
    const [seasons, matches] = await Promise.all([
      this.listSeasons(),
      this.listMatches(),
    ]);
    const orderedSeasons = sortBy(seasons, "startDate", "desc");
    return Promise.all(
      orderedSeasons.map(async (season) => {
        const seasonMatches = await Promise.all(
          matches
            .filter((match) => match.seasonId === season.id)
            .map((match) => this.hydrateMatch(match))
        );
        return {
          ...season,
          matches: seasonMatches,
          champion:
            season.championId == null
              ? null
              : await this.getPlayer(season.championId),
        };
      })
    );
  }

  async listPastSeasonsWithMatches(now: Date): Promise<SeasonWithRelations[]> {
    const seasons = await this.listSeasonSummaries();
    return seasons.filter((season) => season.endDate < now);
  }

  async deleteDuplicateSeasons() {
    return 0;
  }
}

export const store = new FirebaseStore(firestore);
