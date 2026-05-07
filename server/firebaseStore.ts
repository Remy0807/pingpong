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
  type CollectionReference,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";

export type PlayerRecord = {
  id: number;
  groupId: string;
  uid: string | null;
  name: string;
  normalizedName?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SeasonRecord = {
  id: number;
  groupId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  championId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MatchRecord = {
  id: number;
  groupId: string;
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
  groupId: string;
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

export type PortalUserRecord = {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PortalGroupRecord = {
  id: string;
  name: string;
  ownerUid: string;
  joinCode: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PortalMembershipRecord = {
  id: string;
  uid: string;
  groupId: string;
  role: "owner" | "member";
  joinedAt: Date;
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
  if (serviceAccount) {
    const options: AppOptions = {
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID ?? serviceAccount.project_id,
    };
    initializeApp(options);
  } else if (!process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  } else {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
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
    groupId: data.groupId,
    uid: data.uid ?? null,
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
    groupId: data.groupId,
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
    groupId: data.groupId,
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
    groupId: data.groupId,
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

const fromPortalUserDoc = (
  doc: QueryDocumentSnapshot<DocumentData>
): PortalUserRecord => {
  const data = doc.data();
  return {
    uid: data.uid,
    email: data.email ?? null,
    displayName: data.displayName ?? null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
};

const fromPortalGroupDoc = (
  doc: QueryDocumentSnapshot<DocumentData>
): PortalGroupRecord => {
  const data = doc.data();
  return {
    id: data.id,
    name: data.name,
    ownerUid: data.ownerUid,
    joinCode: data.joinCode,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
};

const fromPortalMembershipDoc = (
  doc: QueryDocumentSnapshot<DocumentData>
): PortalMembershipRecord => {
  const data = doc.data();
  return {
    id: data.id,
    uid: data.uid,
    groupId: data.groupId,
    role: data.role,
    joinedAt: toDate(data.joinedAt),
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

  private groupRef(groupId: string) {
    return this.collection("groups").doc(groupId);
  }

  private groupCollection(groupId: string, name: string) {
    return this.groupRef(groupId).collection(name);
  }

  private portalCollection(name: string) {
    return this.collection(name);
  }

  private async nextId(groupId: string, name: string) {
    const ref = this.groupRef(groupId).collection("_meta").doc("counters");
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const counters = (snapshot.data()?.counters as Record<string, number> | undefined) ?? {};
      const next = (counters[name] ?? 0) + 1;
      transaction.set(ref, { counters: { ...counters, [name]: next } }, { merge: true });
      return next;
    });
  }

  async ensurePlayerForUser(
    groupId: string,
    uid: string,
    displayName: string | null
  ) {
    const existing = await this.groupCollection(groupId, "players")
      .where("uid", "==", uid)
      .limit(1)
      .get();
    if (!existing.empty) {
      return fromPlayerDoc(existing.docs[0] as QueryDocumentSnapshot<DocumentData>);
    }

    const id = await this.nextId(groupId, "players");
    const now = new Date();
    const name = (displayName ?? `Speler ${id}`).trim();
    const player: PlayerRecord = {
      id,
      groupId,
      uid,
      name,
      normalizedName: normalizeName(name),
      createdAt: now,
      updatedAt: now,
    };
    await this.groupCollection(groupId, "players").doc(String(id)).set(player);
    return player;
  }

  async ensurePlayersForGroupMembers(groupId: string) {
    const memberships = await this.listMembershipsForGroup(groupId);
    const users = await Promise.all(
      memberships.map(async (membership) => ({
        uid: membership.uid,
        user: await this.getPortalUser(membership.uid),
      }))
    );

    await Promise.all(
      users.map(({ uid, user }) =>
        this.ensurePlayerForUser(groupId, uid, user?.displayName ?? null)
      )
    );
  }

  async upsertUser(user: {
    uid: string;
    email: string | null;
    displayName: string | null;
  }) {
    const ref = this.portalCollection("users").doc(user.uid);
    const snapshot = await ref.get();
    const now = new Date();
    const existing = snapshot.exists
      ? fromPortalUserDoc(snapshot as QueryDocumentSnapshot<DocumentData>)
      : null;
    const next: PortalUserRecord = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName ?? existing?.displayName ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await ref.set(next);
    return next;
  }

  async getPortalUser(uid: string) {
    const snapshot = await this.portalCollection("users").doc(uid).get();
    return snapshot.exists
      ? fromPortalUserDoc(snapshot as QueryDocumentSnapshot<DocumentData>)
      : null;
  }

  async listGroups() {
    const snapshot = await this.portalCollection("groups").get();
    return snapshot.docs.map(fromPortalGroupDoc);
  }

  async getGroup(groupId: string) {
    const snapshot = await this.portalCollection("groups").doc(groupId).get();
    return snapshot.exists
      ? fromPortalGroupDoc(snapshot as QueryDocumentSnapshot<DocumentData>)
      : null;
  }

  async listMembershipsForUser(uid: string) {
    const snapshot = await this.portalCollection("memberships")
      .where("uid", "==", uid)
      .get();
    return snapshot.docs.map(fromPortalMembershipDoc);
  }

  async listMembershipsForGroup(groupId: string) {
    const snapshot = await this.portalCollection("memberships")
      .where("groupId", "==", groupId)
      .get();
    return snapshot.docs.map(fromPortalMembershipDoc);
  }

  async listMemberships() {
    const snapshot = await this.portalCollection("memberships").get();
    return snapshot.docs.map(fromPortalMembershipDoc);
  }

  async isMemberOfGroup(uid: string, groupId: string) {
    const snapshot = await this.portalCollection("memberships")
      .where("uid", "==", uid)
      .where("groupId", "==", groupId)
      .limit(1)
      .get();
    return !snapshot.empty;
  }

  async createGroup(payload: {
    ownerUid: string;
    name: string;
    joinCode: string;
    ownerEmail: string | null;
    ownerDisplayName: string | null;
  }) {
    const id = randomUUID();
    const now = new Date();
    const group: PortalGroupRecord = {
      id,
      name: payload.name.trim(),
      ownerUid: payload.ownerUid,
      joinCode: payload.joinCode.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const membership: PortalMembershipRecord = {
      id: `${id}:${payload.ownerUid}`,
      uid: payload.ownerUid,
      groupId: id,
      role: "owner",
      joinedAt: now,
    };
    await this.db.runTransaction(async (transaction) => {
      transaction.set(this.portalCollection("groups").doc(id), group);
      transaction.set(
        this.portalCollection("memberships").doc(membership.id),
        membership
      );
    });
    await this.upsertUser({
      uid: payload.ownerUid,
      email: payload.ownerEmail,
      displayName: payload.ownerDisplayName,
    });
    await this.ensurePlayerForUser(id, payload.ownerUid, payload.ownerDisplayName);
    return { group, membership };
  }

  async updateGroup(
    groupId: string,
    payload: {
      name?: string;
      joinCode?: string;
    }
  ) {
    const group = await this.getGroup(groupId);
    if (!group) {
      throw new FirebaseNotFoundError("Groep niet gevonden.");
    }

    const updated: PortalGroupRecord = {
      ...group,
      name: payload.name?.trim() || group.name,
      joinCode: payload.joinCode?.trim() || group.joinCode,
      updatedAt: new Date(),
    };

    await this.portalCollection("groups").doc(groupId).set(updated);
    return updated;
  }

  async joinGroup(payload: {
    uid: string;
    email: string | null;
    displayName: string | null;
    groupId: string;
    joinCode: string;
  }) {
    const group = await this.getGroup(payload.groupId);
    if (!group) {
      throw new FirebaseNotFoundError("Groep niet gevonden.");
    }
    if (group.joinCode !== payload.joinCode.trim()) {
      throw new FirebaseUniqueConstraintError("Onjuiste geheime code.");
    }
    const existing = await this.isMemberOfGroup(payload.uid, payload.groupId);
    if (existing) {
      const membership = await this.getMembership(payload.uid, payload.groupId);
      if (!membership) {
        throw new FirebaseNotFoundError("Lidmaatschap niet gevonden.");
      }
      return { group, membership };
    }
    const now = new Date();
    const membership: PortalMembershipRecord = {
      id: `${payload.groupId}:${payload.uid}`,
      uid: payload.uid,
      groupId: payload.groupId,
      role: "member",
      joinedAt: now,
    };
    await this.portalCollection("memberships")
      .doc(membership.id)
      .set(membership);
    await this.upsertUser({
      uid: payload.uid,
      email: payload.email,
      displayName: payload.displayName,
    });
    await this.ensurePlayerForUser(
      payload.groupId,
      payload.uid,
      payload.displayName
    );
    return { group, membership };
  }

  async getMembership(uid: string, groupId: string) {
    const snapshot = await this.portalCollection("memberships")
      .doc(`${groupId}:${uid}`)
      .get();
    return snapshot.exists
      ? fromPortalMembershipDoc(snapshot as QueryDocumentSnapshot<DocumentData>)
      : null;
  }

  async removeMembership(groupId: string, uid: string) {
    const membership = await this.getMembership(uid, groupId);
    if (!membership) {
      throw new FirebaseNotFoundError("Lidmaatschap niet gevonden.");
    }

    await this.portalCollection("memberships")
      .doc(`${groupId}:${uid}`)
      .delete();
    return membership;
  }

  private async deleteCollectionDocs(
    collectionPath: CollectionReference<DocumentData> | Query<DocumentData>
  ) {
    const snapshot = await collectionPath.get();
    if (snapshot.empty) {
      return;
    }

    const batches: FirebaseFirestore.WriteBatch[] = [];
    let batch = this.db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      count += 1;
      if (count === 450) {
        batches.push(batch);
        batch = this.db.batch();
        count = 0;
      }
    }

    if (count > 0) {
      batches.push(batch);
    }

    for (const currentBatch of batches) {
      await currentBatch.commit();
    }
  }

  async deleteGroup(groupId: string) {
    const group = await this.getGroup(groupId);
    if (!group) {
      throw new FirebaseNotFoundError("Groep niet gevonden.");
    }

    await Promise.all([
      this.deleteCollectionDocs(this.portalCollection("memberships").where("groupId", "==", groupId)),
      this.deleteCollectionDocs(this.groupCollection(groupId, "players")),
      this.deleteCollectionDocs(this.groupCollection(groupId, "matches")),
      this.deleteCollectionDocs(this.groupCollection(groupId, "doublesMatches")),
      this.deleteCollectionDocs(this.groupCollection(groupId, "seasons")),
      this.deleteCollectionDocs(this.groupCollection(groupId, "_meta")),
    ]);

    await this.portalCollection("groups").doc(groupId).delete();
    return group;
  }

  async getPortalSession(
    userInfo: { uid: string; email: string | null; displayName: string | null },
    activeGroupId?: string | null
  ) {
    const [user, groups, memberships, allMemberships] = await Promise.all([
      this.upsertUser(userInfo),
      this.listGroups(),
      this.listMembershipsForUser(userInfo.uid),
      this.listMemberships(),
    ]);
    const activeGroup = activeGroupId
      ? groups.find((group) => group.id === activeGroupId) ?? null
      : null;
    return {
      user,
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        ownerUid: group.ownerUid,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        memberCount: allMemberships.filter((membership) => membership.groupId === group.id).length,
      })),
      memberships,
      activeGroupId: activeGroup?.id ?? null,
    };
  }

  async listPlayers(groupId: string) {
    const snapshot = await this.groupCollection(groupId, "players").get();
    return sortBy(snapshot.docs.map(fromPlayerDoc), "name", "asc");
  }

  async getPlayer(groupId: string, id: number) {
    const doc = await this.groupCollection(groupId, "players")
      .doc(String(id))
      .get();
    return doc.exists ? fromPlayerDoc(doc as QueryDocumentSnapshot<DocumentData>) : null;
  }

  async getPlayerByUid(groupId: string, uid: string) {
    const snapshot = await this.groupCollection(groupId, "players")
      .where("uid", "==", uid)
      .limit(1)
      .get();
    return snapshot.empty ? null : fromPlayerDoc(snapshot.docs[0] as QueryDocumentSnapshot<DocumentData>);
  }

  async getPlayersByIds(groupId: string, ids: number[]) {
    const players = await Promise.all(ids.map((id) => this.getPlayer(groupId, id)));
    return players.filter((player): player is PlayerRecord => Boolean(player));
  }

  async createPlayer(groupId: string, name: string, uid?: string | null) {
    const trimmedName = name.trim();
    const normalizedName = normalizeName(trimmedName);
    const existing = await this.groupCollection(groupId, "players")
      .where("normalizedName", "==", normalizedName)
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new FirebaseUniqueConstraintError("Player name must be unique.");
    }

    const id = await this.nextId(groupId, "players");
    const now = new Date();
    const player: PlayerRecord = {
      id,
      groupId,
      uid: uid ?? null,
      name: trimmedName,
      normalizedName,
      createdAt: now,
      updatedAt: now,
    };
    await this.groupCollection(groupId, "players").doc(String(id)).set(player);
    return player;
  }

  async updatePlayer(groupId: string, id: number, data: { name: string }) {
    const existing = await this.getPlayer(groupId, id);
    if (!existing) {
      throw new FirebaseNotFoundError("Player not found.");
    }

    const trimmedName = data.name.trim();
    const normalizedName = normalizeName(trimmedName);
    const duplicate = await this.groupCollection(groupId, "players")
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
    await this.groupCollection(groupId, "players").doc(String(id)).set(updated);
    return updated;
  }

  async deletePlayer(groupId: string, id: number) {
    const existing = await this.getPlayer(groupId, id);
    if (!existing) {
      throw new FirebaseNotFoundError("Player not found.");
    }

    const [matches, doublesMatches] = await Promise.all([
      this.listMatches(groupId),
      this.listDoublesMatches(groupId),
    ]);
    const batch = this.db.batch();
    matches
      .filter((match) => match.playerOneId === id || match.playerTwoId === id)
      .forEach((match) => {
        batch.delete(this.groupCollection(groupId, "matches").doc(String(match.id)));
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
        batch.delete(
          this.groupCollection(groupId, "doublesMatches").doc(String(match.id))
        );
      });
    batch.delete(this.groupCollection(groupId, "players").doc(String(id)));
    await batch.commit();
    return existing;
  }

  async listSeasons(groupId: string) {
    const snapshot = await this.groupCollection(groupId, "seasons").get();
    return snapshot.docs.map(fromSeasonDoc);
  }

  async getSeason(groupId: string, id: number | null | undefined) {
    if (id == null) {
      return null;
    }
    const doc = await this.groupCollection(groupId, "seasons")
      .doc(String(id))
      .get();
    return doc.exists ? fromSeasonDoc(doc as QueryDocumentSnapshot<DocumentData>) : null;
  }

  async findSeasonForDate(groupId: string, date: Date) {
    const seasons = await this.listSeasons(groupId);
    return (
      seasons.find(
        (season) => season.startDate <= date && season.endDate >= date
      ) ?? null
    );
  }

  async findSeasonByBoundaries(groupId: string, startDate: Date, endDate: Date) {
    const seasons = await this.listSeasons(groupId);
    return (
      seasons.find(
        (season) =>
          season.startDate.getTime() === startDate.getTime() &&
          season.endDate.getTime() === endDate.getTime()
      ) ?? null
    );
  }

  async createSeason(
    groupId: string,
    data: {
    name: string;
    startDate: Date;
    endDate: Date;
    championId?: number | null;
  }
  ) {
    const existing = await this.findSeasonByBoundaries(
      groupId,
      data.startDate,
      data.endDate
    );
    if (existing) {
      throw new FirebaseUniqueConstraintError("Season boundaries must be unique.");
    }

    const id = await this.nextId(groupId, "seasons");
    const now = new Date();
    const season: SeasonRecord = {
      id,
      groupId,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      championId: data.championId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.groupCollection(groupId, "seasons").doc(String(id)).set(season);
    return season;
  }

  async updateSeason(groupId: string, id: number, data: Partial<SeasonRecord>) {
    const existing = await this.getSeason(groupId, id);
    if (!existing) {
      throw new FirebaseNotFoundError("Season not found.");
    }

    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    await this.groupCollection(groupId, "seasons").doc(String(id)).set(updated);
    return updated;
  }

  async listMatches(groupId: string) {
    const snapshot = await this.groupCollection(groupId, "matches").get();
    return snapshot.docs.map(fromMatchDoc);
  }

  async getMatch(groupId: string, id: number) {
    const doc = await this.groupCollection(groupId, "matches")
      .doc(String(id))
      .get();
    return doc.exists ? fromMatchDoc(doc as QueryDocumentSnapshot<DocumentData>) : null;
  }

  async createMatch(
    groupId: string,
    data: Omit<MatchRecord, "id" | "createdAt" | "updatedAt">
  ) {
    const id = await this.nextId(groupId, "matches");
    const now = new Date();
    const match: MatchRecord = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await this.groupCollection(groupId, "matches").doc(String(id)).set(match);
    return match;
  }

  async updateMatch(groupId: string, id: number, data: Partial<MatchRecord>) {
    const existing = await this.getMatch(groupId, id);
    if (!existing) {
      throw new FirebaseNotFoundError("Match not found.");
    }
    const updated: MatchRecord = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    await this.groupCollection(groupId, "matches").doc(String(id)).set(updated);
    return updated;
  }

  async deleteMatch(groupId: string, id: number) {
    const existing = await this.getMatch(groupId, id);
    if (!existing) {
      throw new FirebaseNotFoundError("Match not found.");
    }
    await this.groupCollection(groupId, "matches").doc(String(id)).delete();
    return existing;
  }

  async listDoublesMatches(groupId: string) {
    const snapshot = await this.groupCollection(groupId, "doublesMatches").get();
    return snapshot.docs.map(fromDoublesMatchDoc);
  }

  async getDoublesMatch(groupId: string, id: number) {
    const doc = await this.groupCollection(groupId, "doublesMatches")
      .doc(String(id))
      .get();
    return doc.exists
      ? fromDoublesMatchDoc(doc as QueryDocumentSnapshot<DocumentData>)
      : null;
  }

  async createDoublesMatch(
    groupId: string,
    data: Omit<DoublesMatchRecord, "id" | "createdAt" | "updatedAt">
  ) {
    const id = await this.nextId(groupId, "doublesMatches");
    const now = new Date();
    const match: DoublesMatchRecord = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await this.groupCollection(groupId, "doublesMatches")
      .doc(String(id))
      .set(match);
    return match;
  }

  async updateDoublesMatch(
    groupId: string,
    id: number,
    data: Partial<DoublesMatchRecord>
  ) {
    const existing = await this.getDoublesMatch(groupId, id);
    if (!existing) {
      throw new FirebaseNotFoundError("Doubles match not found.");
    }
    const updated: DoublesMatchRecord = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    await this.groupCollection(groupId, "doublesMatches")
      .doc(String(id))
      .set(updated);
    return updated;
  }

  async deleteDoublesMatch(groupId: string, id: number) {
    const existing = await this.getDoublesMatch(groupId, id);
    if (!existing) {
      throw new FirebaseNotFoundError("Doubles match not found.");
    }
    await this.groupCollection(groupId, "doublesMatches")
      .doc(String(id))
      .delete();
    return existing;
  }

  async hydrateMatch(groupId: string, match: MatchRecord): Promise<MatchWithRelations> {
    const [playerOne, playerTwo, winner, season] = await Promise.all([
      this.getPlayer(groupId, match.playerOneId),
      this.getPlayer(groupId, match.playerTwoId),
      this.getPlayer(groupId, match.winnerId),
      this.getSeason(groupId, match.seasonId),
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
    groupId: string,
    match: DoublesMatchRecord
  ): Promise<DoublesMatchWithRelations> {
    const [
      teamOnePlayerA,
      teamOnePlayerB,
      teamTwoPlayerA,
      teamTwoPlayerB,
      season,
    ] = await Promise.all([
      this.getPlayer(groupId, match.teamOnePlayerAId),
      this.getPlayer(groupId, match.teamOnePlayerBId),
      this.getPlayer(groupId, match.teamTwoPlayerAId),
      this.getPlayer(groupId, match.teamTwoPlayerBId),
      this.getSeason(groupId, match.seasonId),
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

  async fetchPlayersWithRelations(
    groupId: string,
    playerId?: number
  ): Promise<PlayerWithRelations[]> {
    const [players, matches] = await Promise.all([
      this.listPlayers(groupId),
      this.listMatches(groupId),
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

  async getChampionCounts(groupId: string) {
    const seasons = await this.listSeasons(groupId);
    const map = new Map<number, number>();
    seasons.forEach((season) => {
      if (season.championId != null) {
        map.set(season.championId, (map.get(season.championId) ?? 0) + 1);
      }
    });
    return map;
  }

  async listSeasonSummaries(groupId: string): Promise<SeasonWithRelations[]> {
    const [seasons, matches] = await Promise.all([
      this.listSeasons(groupId),
      this.listMatches(groupId),
    ]);
    const orderedSeasons = sortBy(seasons, "startDate", "desc");
    return Promise.all(
      orderedSeasons.map(async (season) => {
        const seasonMatches = await Promise.all(
          matches
            .filter((match) => match.seasonId === season.id)
            .map((match) => this.hydrateMatch(groupId, match))
        );
        return {
          ...season,
          matches: seasonMatches,
          champion:
            season.championId == null
              ? null
              : await this.getPlayer(groupId, season.championId),
        };
      })
    );
  }

  async listPastSeasonsWithMatches(
    groupId: string,
    now: Date
  ): Promise<SeasonWithRelations[]> {
    const seasons = await this.listSeasonSummaries(groupId);
    return seasons.filter((season) => season.endDate < now);
  }

  async deleteDuplicateSeasons() {
    return 0;
  }
}

export const store = new FirebaseStore(firestore);
