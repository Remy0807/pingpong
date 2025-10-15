import "dotenv/config";
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response
} from "express";
import cors from "cors";
import { PrismaClient, Prisma, type User } from "@prisma/client";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT) || 4000;
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dagen

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be set to enable authentication.");
}

const scrypt = promisify(scryptCallback);

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: number;
      username: string;
    };
  }
}

type PrismaErrorWithCode = { code: string };

const isPrismaErrorWithCode = (error: unknown): error is PrismaErrorWithCode => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
};

const base64UrlEncode = (input: string | Buffer) => {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
};

const base64UrlDecode = (input: string) => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
};

const safeCompare = (a: string, b: string) => {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
};

type TokenPayload = {
  sub: string;
  username: string;
  iat: number;
  exp: number;
};

const createTokenPayload = (user: { id: number; username: string }): TokenPayload => {
  const issuedAt = Math.floor(Date.now() / 1000);
  return {
    sub: user.id.toString(),
    username: user.username,
    iat: issuedAt,
    exp: issuedAt + TOKEN_TTL_SECONDS
  };
};

const signAccessToken = (user: { id: number; username: string }) => {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = createTokenPayload(user);
  const headerSegment = base64UrlEncode(JSON.stringify(header));
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", JWT_SECRET)
    .update(`${headerSegment}.${payloadSegment}`)
    .digest();
  const signatureSegment = base64UrlEncode(signature);
  return `${headerSegment}.${payloadSegment}.${signatureSegment}`;
};

const verifyAccessToken = (token: string): TokenPayload => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const expectedSignatureSegment = base64UrlEncode(
    createHmac("sha256", JWT_SECRET).update(`${headerSegment}.${payloadSegment}`).digest()
  );

  if (!safeCompare(signatureSegment, expectedSignatureSegment)) {
    throw new Error("Invalid signature");
  }

  const headerJson = JSON.parse(base64UrlDecode(headerSegment).toString("utf8")) as {
    alg?: string;
    typ?: string;
  };

  if (headerJson.alg !== "HS256" || headerJson.typ !== "JWT") {
    throw new Error("Unsupported token header");
  }

  const payloadJson = JSON.parse(base64UrlDecode(payloadSegment).toString("utf8")) as TokenPayload;
  if (typeof payloadJson.exp !== "number" || typeof payloadJson.sub !== "string") {
    throw new Error("Invalid token payload");
  }

  if (payloadJson.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payloadJson;
};

const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
};

const verifyPassword = async (password: string, hash: string) => {
  const [salt, hashHex] = hash.split(":");
  if (!salt || !hashHex) {
    return false;
  }
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(hashHex, "hex");
  if (storedKey.length !== derivedKey.length) {
    return false;
  }
  return timingSafeEqual(storedKey, derivedKey);
};

const toPublicUser = (user: User) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString()
});

const authenticate: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authenticatie vereist." });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json({ message: "Authenticatie vereist." });
    }

    const payload = verifyAccessToken(token);
    const userId = Number.parseInt(payload.sub, 10);
    if (!Number.isInteger(userId)) {
      return res.status(401).json({ message: "Token ongeldig." });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ message: "Gebruiker niet gevonden." });
    }

    req.user = { id: user.id, username: user.username };
    next();
  } catch (_error) {
    return res.status(401).json({ message: "Token ongeldig of verlopen." });
  }
};

app.use(cors());
app.use(express.json());

const normalizeUsername = (value: unknown) =>
  typeof value === "string" ? value.trim() : null;

const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : null;

app.post("/auth/register", async (req, res, next) => {
  const { username, email, password } = req.body ?? {};
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedUsername || normalizedUsername.length < 3) {
    return res
      .status(400)
      .json({ message: "Gebruikersnaam moet minimaal drie tekens bevatten." });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ message: "Wachtwoord moet minimaal acht tekens bevatten." });
  }

  try {
    const existingByUsername = await prisma.user.findUnique({
      where: { username: normalizedUsername }
    });
    if (existingByUsername) {
      return res.status(409).json({ message: "Deze gebruikersnaam is al in gebruik." });
    }

    if (normalizedEmail) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail }
      });
      if (existingByEmail) {
        return res.status(409).json({ message: "Dit e-mailadres is al in gebruik." });
      }
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash
      }
    });

    const token = signAccessToken(user);
    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/auth/login", async (req, res, next) => {
  const { username, email, password } = req.body ?? {};

  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ message: "Wachtwoord is verplicht." });
  }

  try {
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);

    let user: User | null = null;
    if (normalizedUsername) {
      user = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    }
    if (!user && normalizedEmail) {
      user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    }

    if (!user) {
      return res.status(401).json({ message: "Onjuiste inloggegevens." });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Onjuiste inloggegevens." });
    }

    const token = signAccessToken(user);
    res.json({ token, user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/auth/me", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authenticatie vereist." });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ message: "Gebruiker niet gevonden." });
    }
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

const friendshipInclude = {
  requester: true,
  addressee: true
} as const;

type FriendshipWithUsers = Prisma.FriendshipGetPayload<{ include: typeof friendshipInclude }>;

const toFriendEntry = (friendship: FriendshipWithUsers, currentUserId: number) => {
  const otherUser = friendship.requesterId === currentUserId ? friendship.addressee : friendship.requester;
  const direction =
    friendship.status === Prisma.FriendshipStatus.ACCEPTED
      ? "accepted"
      : friendship.requesterId === currentUserId
      ? "outgoing"
      : "incoming";
  return {
    id: friendship.id,
    status: friendship.status,
    direction,
    createdAt: friendship.createdAt.toISOString(),
    updatedAt: friendship.updatedAt.toISOString(),
    user: toPublicUser(otherUser)
  };
};

const findFriendshipBetween = (userId: number, otherUserId: number) =>
  prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: otherUserId },
        { requesterId: otherUserId, addresseeId: userId }
      ]
    },
    include: friendshipInclude
  });

const groupInclude = {
  owner: true,
  members: {
    include: {
      user: true
    }
  }
} as const;

type GroupWithMembers = Prisma.GroupGetPayload<{ include: typeof groupInclude }>;

const toGroupSummary = (group: GroupWithMembers, currentUserId: number) => {
  const membership = group.members.find((member) => member.userId === currentUserId);
  return {
    id: group.id,
    name: group.name,
    ownerId: group.ownerId,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    yourRole: membership?.role ?? null,
    members: group.members.map((member) => ({
      id: member.id,
      role: member.role,
      joinedAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
      isYou: member.userId === currentUserId,
      user: toPublicUser(member.user)
    }))
  };
};

const groupInviteInclude = {
  group: {
    select: {
      id: true,
      name: true,
      ownerId: true
    }
  },
  inviter: true,
  invitee: true
} as const;

type GroupInviteWithRelations = Prisma.GroupInviteGetPayload<{ include: typeof groupInviteInclude }>;

const toGroupInviteEntry = (invite: GroupInviteWithRelations, currentUserId: number) => ({
  id: invite.id,
  status: invite.status,
  direction: invite.inviteeId === currentUserId ? "incoming" : "outgoing",
  createdAt: invite.createdAt.toISOString(),
  updatedAt: invite.updatedAt.toISOString(),
  group: invite.group,
  inviter: toPublicUser(invite.inviter),
  invitee: toPublicUser(invite.invitee)
});

const getGroupMembership = (groupId: number, userId: number) =>
  prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId
      }
    }
  });

const canManageGroup = async (groupId: number, userId: number) => {
  const membership = await getGroupMembership(groupId, userId);
  if (!membership) {
    return null;
  }
  if (
    membership.role === Prisma.GroupRole.OWNER ||
    membership.role === Prisma.GroupRole.ADMIN
  ) {
    return membership;
  }
  return null;
};

type PlayerWithRelations = Awaited<ReturnType<typeof fetchPlayersWithRelations>>[number];

app.get("/api/friends", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authenticatie vereist." });
    }
    const currentUserId = req.user.id;
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: currentUserId }, { addresseeId: currentUserId }]
      },
      orderBy: { createdAt: "desc" },
      include: friendshipInclude
    });

    const accepted = friendships
      .filter((friendship) => friendship.status === Prisma.FriendshipStatus.ACCEPTED)
      .map((friendship) => toFriendEntry(friendship, currentUserId));
    const pendingSent = friendships
      .filter(
        (friendship) =>
          friendship.status === Prisma.FriendshipStatus.PENDING &&
          friendship.requesterId === currentUserId
      )
      .map((friendship) => toFriendEntry(friendship, currentUserId));
    const pendingReceived = friendships
      .filter(
        (friendship) =>
          friendship.status === Prisma.FriendshipStatus.PENDING &&
          friendship.addresseeId === currentUserId
      )
      .map((friendship) => toFriendEntry(friendship, currentUserId));
    const declined = friendships
      .filter((friendship) => friendship.status === Prisma.FriendshipStatus.DECLINED)
      .map((friendship) => toFriendEntry(friendship, currentUserId));

    res.json({
      friends: accepted,
      pending: {
        sent: pendingSent,
        received: pendingReceived
      },
      declined
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/friends/request", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authenticatie vereist." });
    }
    const currentUserId = req.user.id;
    const { userId, username } = req.body ?? {};

    let targetUser: User | null = null;
    if (typeof userId === "number" && Number.isInteger(userId)) {
      targetUser = await prisma.user.findUnique({ where: { id: userId } });
    }
    if (!targetUser) {
      const normalizedUsername = normalizeUsername(username);
      if (normalizedUsername) {
        targetUser = await prisma.user.findUnique({ where: { username: normalizedUsername } });
      }
    }

    if (!targetUser) {
      return res.status(404).json({ message: "Gebruiker niet gevonden." });
    }

    if (targetUser.id === currentUserId) {
      return res.status(400).json({ message: "Je kunt jezelf geen vriendschapsverzoek sturen." });
    }

    const existing = await findFriendshipBetween(currentUserId, targetUser.id);
    if (existing) {
      if (existing.status === Prisma.FriendshipStatus.BLOCKED) {
        return res.status(403).json({ message: "Vriendschap is geblokkeerd." });
      }
      if (existing.status === Prisma.FriendshipStatus.ACCEPTED) {
        return res.status(409).json({ message: "Jullie zijn al vrienden." });
      }
      if (existing.status === Prisma.FriendshipStatus.PENDING) {
        if (existing.requesterId === currentUserId) {
          return res.status(409).json({ message: "Verzoek is al verstuurd." });
        }
        return res.status(409).json({
          message: "Deze gebruiker heeft jou al een verzoek gestuurd. Beantwoord dat verzoek.",
          friendship: toFriendEntry(existing, currentUserId)
        });
      }

      const updated = await prisma.friendship.update({
        where: { id: existing.id },
        data: {
          requesterId: currentUserId,
          addresseeId: targetUser.id,
          status: Prisma.FriendshipStatus.PENDING,
          createdAt: new Date()
        },
        include: friendshipInclude
      });

      return res.json({ friendship: toFriendEntry(updated, currentUserId) });
    }

    const friendship = await prisma.friendship.create({
      data: {
        requesterId: currentUserId,
        addresseeId: targetUser.id,
        status: Prisma.FriendshipStatus.PENDING
      },
      include: friendshipInclude
    });

    res.status(201).json({ friendship: toFriendEntry(friendship, currentUserId) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/friends/respond", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authenticatie vereist." });
    }

    const { friendshipId, action } = req.body ?? {};
    const id = Number.parseInt(String(friendshipId), 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Ongeldig verzoek id." });
    }
    if (typeof action !== "string") {
      return res.status(400).json({ message: "Actie is verplicht." });
    }

    const normalizedAction = action.toLowerCase();
    if (!["accept", "decline", "cancel"].includes(normalizedAction)) {
      return res.status(400).json({ message: "Onbekende actie." });
    }

    const friendship = await prisma.friendship.findUnique({
      where: { id },
      include: friendshipInclude
    });

    if (!friendship) {
      return res.status(404).json({ message: "Verzoek niet gevonden." });
    }

    const currentUserId = req.user.id;

    if (normalizedAction === "cancel") {
      if (friendship.requesterId !== currentUserId) {
        return res.status(403).json({ message: "Alleen de verzender kan een verzoek annuleren." });
      }
      await prisma.friendship.delete({ where: { id } });
      return res.status(204).end();
    }

    if (friendship.addresseeId !== currentUserId) {
      return res.status(403).json({ message: "Je kunt alleen ontvangen verzoeken beantwoorden." });
    }

    if (normalizedAction === "accept") {
      if (friendship.status === Prisma.FriendshipStatus.ACCEPTED) {
        return res.status(409).json({ message: "Verzoek was al geaccepteerd." });
      }
      const updated = await prisma.friendship.update({
        where: { id },
        data: { status: Prisma.FriendshipStatus.ACCEPTED },
        include: friendshipInclude
      });
      return res.json({ friendship: toFriendEntry(updated, currentUserId) });
    }

    const declined = await prisma.friendship.update({
      where: { id },
      data: { status: Prisma.FriendshipStatus.DECLINED },
      include: friendshipInclude
    });
    return res.json({ friendship: toFriendEntry(declined, currentUserId) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/groups", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authenticatie vereist." });
    }
    const currentUserId = req.user.id;
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: { userId: currentUserId }
        }
      },
      orderBy: { createdAt: "asc" },
      include: groupInclude
    });

    res.json({
      groups: groups.map((group) => toGroupSummary(group, currentUserId))
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/groups", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authenticatie vereist." });
    }
    const currentUserId = req.user.id;
    const { name } = req.body ?? {};
    const groupName = typeof name === "string" ? name.trim() : "";
    if (groupName.length < 3) {
      return res
        .status(400)
        .json({ message: "Groepsnaam moet minimaal drie tekens bevatten." });
    }

    const group = await prisma.group.create({
      data: {
        name: groupName,
        ownerId: currentUserId,
        members: {
          create: {
            userId: currentUserId,
            role: Prisma.GroupRole.OWNER
          }
        }
      },
      include: groupInclude
    });

    res.status(201).json({ group: toGroupSummary(group, currentUserId) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/groups/invites", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authenticatie vereist." });
    }
    const currentUserId = req.user.id;
    const invites = await prisma.groupInvite.findMany({
      where: {
        OR: [{ inviteeId: currentUserId }, { inviterId: currentUserId }]
      },
      orderBy: { createdAt: "desc" },
      include: groupInviteInclude
    });
    res.json({
      invites: invites.map((invite) => toGroupInviteEntry(invite, currentUserId))
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/groups/:groupId/invite", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authenticatie vereist." });
    }

    const groupId = Number.parseInt(req.params.groupId, 10);
    if (!Number.isInteger(groupId)) {
      return res.status(400).json({ message: "Ongeldig groeps-ID." });
    }

    const currentUserId = req.user.id;
    const membership = await canManageGroup(groupId, currentUserId);
    if (!membership) {
      return res.status(403).json({ message: "Je hebt geen beheerrechten voor deze groep." });
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ message: "Groep niet gevonden." });
    }

    const { userId, username } = req.body ?? {};
    let targetUser: User | null = null;
    if (typeof userId === "number" && Number.isInteger(userId)) {
      targetUser = await prisma.user.findUnique({ where: { id: userId } });
    }
    if (!targetUser) {
      const normalizedUsername = normalizeUsername(username);
      if (normalizedUsername) {
        targetUser = await prisma.user.findUnique({ where: { username: normalizedUsername } });
      }
    }

    if (!targetUser) {
      return res.status(404).json({ message: "Gebruiker niet gevonden." });
    }

    if (targetUser.id === currentUserId) {
      return res.status(400).json({ message: "Je kunt jezelf geen uitnodiging sturen." });
    }

    const existingMembership = await getGroupMembership(groupId, targetUser.id);
    if (existingMembership) {
      return res.status(409).json({ message: "Gebruiker is al lid van deze groep." });
    }

    const areFriends = await prisma.friendship.findFirst({
      where: {
        status: Prisma.FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: currentUserId, addresseeId: targetUser.id },
          { requesterId: targetUser.id, addresseeId: currentUserId }
        ]
      }
    });

    if (!areFriends) {
      return res.status(403).json({ message: "Alleen vrienden kunnen worden uitgenodigd." });
    }

    const existingInvite = await prisma.groupInvite.findUnique({
      where: {
        groupId_inviteeId: {
          groupId,
          inviteeId: targetUser.id
        }
      },
      include: groupInviteInclude
    });

    if (existingInvite) {
      if (existingInvite.status === Prisma.GroupInviteStatus.PENDING) {
        return res
          .status(409)
          .json({ message: "Deze gebruiker heeft al een openstaande uitnodiging." });
      }
      if (existingInvite.status === Prisma.GroupInviteStatus.ACCEPTED) {
        return res.status(409).json({ message: "Deze gebruiker is al toegetreden." });
      }

      const refreshedInvite = await prisma.groupInvite.update({
        where: { id: existingInvite.id },
        data: {
          inviterId: currentUserId,
          status: Prisma.GroupInviteStatus.PENDING,
          createdAt: new Date()
        },
        include: groupInviteInclude
      });
      return res.json({ invite: toGroupInviteEntry(refreshedInvite, currentUserId) });
    }

    const invite = await prisma.groupInvite.create({
      data: {
        groupId,
        inviterId: currentUserId,
        inviteeId: targetUser.id,
        status: Prisma.GroupInviteStatus.PENDING
      },
      include: groupInviteInclude
    });

    res.status(201).json({ invite: toGroupInviteEntry(invite, currentUserId) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/groups/invites/:inviteId/respond", authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authenticatie vereist." });
    }

    const inviteId = Number.parseInt(req.params.inviteId, 10);
    if (!Number.isInteger(inviteId)) {
      return res.status(400).json({ message: "Ongeldig uitnodigings-ID." });
    }

    const { action } = req.body ?? {};
    if (typeof action !== "string") {
      return res.status(400).json({ message: "Actie is verplicht." });
    }
    const normalizedAction = action.toLowerCase();
    if (!["accept", "decline", "cancel"].includes(normalizedAction)) {
      return res.status(400).json({ message: "Onbekende actie." });
    }

    const invite = await prisma.groupInvite.findUnique({
      where: { id: inviteId },
      include: groupInviteInclude
    });

    if (!invite) {
      return res.status(404).json({ message: "Uitnodiging niet gevonden." });
    }

    const currentUserId = req.user.id;

    if (normalizedAction === "cancel") {
      if (invite.inviterId !== currentUserId) {
        return res.status(403).json({ message: "Alleen de verzender kan een uitnodiging intrekken." });
      }
      if (invite.status !== Prisma.GroupInviteStatus.PENDING) {
        return res.status(409).json({ message: "Uitnodiging is al verwerkt." });
      }
      await prisma.groupInvite.delete({ where: { id: inviteId } });
      return res.status(204).end();
    }

    if (invite.inviteeId !== currentUserId) {
      return res.status(403).json({ message: "Je kunt alleen eigen uitnodigingen beantwoorden." });
    }

    if (normalizedAction === "accept") {
      if (invite.status === Prisma.GroupInviteStatus.ACCEPTED) {
        return res.status(409).json({ message: "Uitnodiging was al geaccepteerd." });
      }
      if (invite.status === Prisma.GroupInviteStatus.DECLINED) {
        return res.status(409).json({ message: "Uitnodiging was eerder geweigerd." });
      }

      const updatedInvite = await prisma.$transaction(async (transaction) => {
        const acceptedInvite = await transaction.groupInvite.update({
          where: { id: inviteId },
          data: { status: Prisma.GroupInviteStatus.ACCEPTED },
          include: groupInviteInclude
        });

        await transaction.groupMember.upsert({
          where: {
            groupId_userId: {
              groupId: invite.groupId,
              userId: currentUserId
            }
          },
          update: { role: Prisma.GroupRole.MEMBER },
          create: {
            groupId: invite.groupId,
            userId: currentUserId,
            role: Prisma.GroupRole.MEMBER
          }
        });

        return acceptedInvite;
      });

      return res.json({ invite: toGroupInviteEntry(updatedInvite, currentUserId) });
    }

    if (invite.status !== Prisma.GroupInviteStatus.PENDING) {
      return res.status(409).json({ message: "Uitnodiging is al verwerkt." });
    }

    const declinedInvite = await prisma.groupInvite.update({
      where: { id: inviteId },
      data: { status: Prisma.GroupInviteStatus.DECLINED },
      include: groupInviteInclude
    });
    return res.json({ invite: toGroupInviteEntry(declinedInvite, currentUserId) });
  } catch (error) {
    next(error);
  }
});

const getSeasonBoundaries = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const buildSeasonName = (date: Date) => {
  return `${date.toLocaleString("nl-NL", { month: "long" })} ${date.getFullYear()}`.replace(
    /^\w/,
    (c) => c.toUpperCase()
  );
};

async function getOrCreateSeasonForDate(date: Date) {
  const { start, end } = getSeasonBoundaries(date);
  const existing = await prisma.season.findFirst({
    where: {
      startDate: { lte: date },
      endDate: { gte: date }
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.season.create({
    data: {
      name: `Seizoen ${buildSeasonName(date)}`,
      startDate: start,
      endDate: end
    }
  });
}

const calculatePlayerEnhancements = (
  player: PlayerWithRelations,
  currentSeason: Awaited<ReturnType<typeof getOrCreateSeasonForDate>>,
  championCounts: Map<number, number>
) => {
  const matches = [...player.matchesAsPlayerOne, ...player.matchesAsPlayerTwo].sort(
    (a, b) => a.playedAt.getTime() - b.playedAt.getTime()
  );

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
      match.playedAt >= currentSeason.startDate && match.playedAt <= currentSeason.endDate
  );
  const seasonWins = seasonMatches.filter((match) => match.winnerId === player.id).length;
  const seasonLosses = seasonMatches.length - seasonWins;
  const badges: string[] = [];

  if (currentStreak >= 3) {
    badges.push("In vorm");
  }
  if (seasonMatches.length >= 3 && seasonLosses === 0) {
    badges.push("Perfecte maand");
  }
  if (seasonMatches.length >= 5 && seasonWins / (seasonMatches.length || 1) >= 0.75) {
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

  return { badges, currentStreak, longestStreak, championships, justReachedStreakFive };
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
      const scored = isPlayerOne ? match.playerOnePoints : match.playerTwoPoints;
      const conceded = isPlayerOne ? match.playerTwoPoints : match.playerOnePoints;
      return {
        for: acc.for + scored,
        against: acc.against + conceded
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
      updatedAt: player.updatedAt.toISOString()
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
    justReachedStreakFive: enhancements.justReachedStreakFive
  };
};

async function fetchPlayersWithRelations(playerId?: number) {
  return prisma.player.findMany({
    where: playerId ? { id: playerId } : undefined,
    orderBy: { name: "asc" },
    include: {
      matchesAsPlayerOne: true,
      matchesAsPlayerTwo: true,
      matchesWon: true
    }
  });
}

const matchInclude = {
  playerOne: true,
  playerTwo: true,
  winner: true,
  season: true
} as const;

type MatchWithRelations = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;

const getChampionCounts = async () => {
  const championGroups = await prisma.season.groupBy({
    by: ["championId"],
    _count: {
      championId: true
    },
    where: {
      championId: {
        not: null
      }
    }
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
  pointDifferential: number;
};

const calculateSeasonStandings = (matches: MatchWithRelations[]): SeasonStanding[] => {
  const statsMap = new Map<number, Omit<SeasonStanding, "player" | "winRate" | "pointDifferential"> & {
    player: { id: number; name: string };
  }>();

  for (const match of matches) {
    const players = [
      { record: match.playerOne, scored: match.playerOnePoints, conceded: match.playerTwoPoints },
      { record: match.playerTwo, scored: match.playerTwoPoints, conceded: match.playerOnePoints }
    ];

    players.forEach(({ record, scored, conceded }) => {
      const existing =
        statsMap.get(record.id) ??
        {
          player: { id: record.id, name: record.name },
          wins: 0,
          losses: 0,
          matches: 0,
          pointsFor: 0,
          pointsAgainst: 0
        };
      existing.matches += 1;
      existing.pointsFor += scored;
      existing.pointsAgainst += conceded;
      if (match.winnerId === record.id) {
        existing.wins += 1;
      } else {
        existing.losses += 1;
      }
      statsMap.set(record.id, existing);
    });
  }

  return Array.from(statsMap.values())
    .map((entry) => ({
      player: entry.player,
      wins: entry.wins,
      losses: entry.losses,
      matches: entry.matches,
      pointsFor: entry.pointsFor,
      pointsAgainst: entry.pointsAgainst,
      winRate: entry.matches ? entry.wins / entry.matches : 0,
      pointDifferential: entry.pointsFor - entry.pointsAgainst
    }))
    .sort((a, b) => {
      if (b.winRate === a.winRate) {
        if (b.pointDifferential === a.pointDifferential) {
          return b.matches - a.matches;
        }
        return b.pointDifferential - a.pointDifferential;
      }
      return b.winRate - a.winRate;
    });
};

const ensurePastSeasonChampions = async () => {
  const now = new Date();
  const pastSeasons = await prisma.season.findMany({
    where: { endDate: { lt: now } },
    include: {
      matches: {
        include: matchInclude
      }
    }
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
        data: { championId }
      });
    })
  );
};

const getLeaderboardSnapshot = async () => {
  const [players, currentSeason, championCounts] = await Promise.all([
    fetchPlayersWithRelations(),
    getOrCreateSeasonForDate(new Date()),
    getChampionCounts()
  ]);

  return players
    .map((player) => buildPlayerStats(player, { currentSeason, championCounts }))
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
  actions
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
        content: cardContent
      }
    ]
  };

  const response = await fetch(TEAMS_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    console.error("Teams webhook responded with", response.status, await response.text());
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
        size: "Large"
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
                wrap: true
              },
              {
                type: "TextBlock",
                text: `Seizoen: ${match.season?.name ?? "Onbekend"}`,
                isSubtle: true,
                spacing: "Small",
                wrap: true
              },
              {
                type: "TextBlock",
                text: `Winnaar: ${match.winner.name}`,
                wrap: true
              }
            ]
          },
          {
            type: "Column",
            width: 1,
            items: [
              {
                type: "TextBlock",
                text: "Score",
                weight: "Bolder",
                horizontalAlignment: "Center"
              },
              {
                type: "TextBlock",
                text: `${match.playerOnePoints} - ${match.playerTwoPoints}`,
                size: "ExtraLarge",
                weight: "Bolder",
                horizontalAlignment: "Center"
              }
            ],
            verticalContentAlignment: "Center"
          }
        ]
      }
    ];

    const topFive = leaderboard.slice(0, 5);
    if (topFive.length) {
      body.push({
        type: "TextBlock",
        text: "Actuele top 5",
        weight: "Bolder",
        spacing: "Medium"
      });
      body.push({
        type: "FactSet",
        facts: topFive.map((entry, index) => {
          const winPercentage = entry.winRate ? Math.round(entry.winRate * 100) : 0;
          return {
            title: `${index + 1}. ${entry.player.name}`,
            value: `${entry.wins}W/${entry.losses}L (${winPercentage}%)`
          };
        })
      });
    }

    const badgeHolders = leaderboard.filter((entry) => entry.badges.length > 0).slice(0, 3);
    if (badgeHolders.length) {
      body.push({
        type: "TextBlock",
        text: "Spelers in vorm",
        weight: "Bolder",
        spacing: "Medium"
      });
      body.push({
        type: "TextBlock",
        text: badgeHolders
          .map((entry) => `${entry.player.name}: ${entry.badges.join(", ")}`)
          .join("\n"),
        wrap: true
      });
    }

    const streakMilestones = leaderboard.filter((entry) => entry.justReachedStreakFive);
    if (streakMilestones.length) {
      body.push({
        type: "TextBlock",
        text: "Streak alert",
        weight: "Bolder",
        spacing: "Medium"
      });
      body.push({
        type: "TextBlock",
        text: streakMilestones
          .map((entry) => `${entry.player.name} staat op een winstreak van ${entry.currentStreak}!`)
          .join("\n"),
        wrap: true
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
        size: "Medium"
      },
      {
        type: "TextBlock",
        text:
          payload.type === "created"
            ? `${payload.name} is toegevoegd aan de competitie.`
            : payload.type === "updated"
            ? `${payload.previousName ?? payload.name} heet nu ${payload.name}.`
            : `${payload.name} is uit de competitie verwijderd.`,
        wrap: true
      }
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
        size: "Large"
      },
      {
        type: "TextBlock",
        text: `${match.playerOne.name} vs ${match.playerTwo.name}`,
        weight: "Bolder",
        size: "Medium",
        wrap: true
      },
      {
        type: "TextBlock",
        text: `Score: ${match.playerOnePoints}-${match.playerTwoPoints}`,
        wrap: true
      },
      {
        type: "TextBlock",
        text: `Winnaar: ${match.winner.name}`,
        wrap: true
      },
      {
        type: "TextBlock",
        text: `Seizoen: ${match.season?.name ?? "Onbekend"}`,
        isSubtle: true,
        wrap: true
      }
    ];

    const topThree = leaderboard.slice(0, 3);
    if (topThree.length) {
      body.push({
        type: "TextBlock",
        text: "Top 3 na wijziging",
        weight: "Bolder",
        spacing: "Medium"
      });
      body.push({
        type: "FactSet",
        facts: topThree.map((entry, index) => {
          const winPercentage = entry.winRate ? Math.round(entry.winRate * 100) : 0;
          return {
            title: `${index + 1}. ${entry.player.name}`,
            value: `${entry.wins}W/${entry.losses}L (${winPercentage}%)`
          };
        })
      });
    }

    const streakMilestones = leaderboard.filter((entry) => entry.justReachedStreakFive);
    if (streakMilestones.length) {
      body.push({
        type: "TextBlock",
        text: "Streak alert",
        weight: "Bolder",
        spacing: "Medium"
      });
      body.push({
        type: "TextBlock",
        text: streakMilestones
          .map((entry) => `${entry.player.name} staat op een winstreak van ${entry.currentStreak}!`)
          .join("\n"),
        wrap: true
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
        size: "Large"
      },
      {
        type: "TextBlock",
        text: `${match.playerOne.name} vs ${match.playerTwo.name}`,
        weight: "Bolder",
        size: "Medium",
        wrap: true
      },
      {
        type: "TextBlock",
        text: `Score was: ${match.playerOnePoints}-${match.playerTwoPoints}`,
        wrap: true
      },
      {
        type: "TextBlock",
        text: `Winnaar was: ${match.winner.name}`,
        wrap: true
      }
    ];

    const topThree = leaderboard.slice(0, 3);
    if (topThree.length) {
      body.push({
        type: "TextBlock",
        text: "Top 3 na verwijdering",
        weight: "Bolder",
        spacing: "Medium"
      });
      body.push({
        type: "FactSet",
        facts: topThree.map((entry, index) => {
          const winPercentage = entry.winRate ? Math.round(entry.winRate * 100) : 0;
          return {
            title: `${index + 1}. ${entry.player.name}`,
            value: `${entry.wins}W/${entry.losses}L (${winPercentage}%)`
          };
        })
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
    updatedAt: match.playerOne.updatedAt.toISOString()
  },
  playerTwo: {
    ...match.playerTwo,
    createdAt: match.playerTwo.createdAt.toISOString(),
    updatedAt: match.playerTwo.updatedAt.toISOString()
  },
  winner: {
    ...match.winner,
    createdAt: match.winner.createdAt.toISOString(),
    updatedAt: match.winner.updatedAt.toISOString()
  },
  season: match.season
    ? {
        id: match.season.id,
        name: match.season.name,
        startDate: match.season.startDate.toISOString(),
        endDate: match.season.endDate.toISOString()
      }
    : null,
  createdAt: match.createdAt.toISOString(),
  updatedAt: match.updatedAt.toISOString()
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/players", async (_req, res, next) => {
  try {
    await ensurePastSeasonChampions();
    const [players, currentSeason, championCounts] = await Promise.all([
      fetchPlayersWithRelations(),
      getOrCreateSeasonForDate(new Date()),
      getChampionCounts()
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
      data: { name: name.trim() }
    });

    const [playerWithRelations, currentSeason, championCounts] = await Promise.all([
      fetchPlayersWithRelations(player.id),
      getOrCreateSeasonForDate(new Date()),
      getChampionCounts()
    ]);

    const statsSource = playerWithRelations[0];
    if (!statsSource) {
      return res.status(500).json({ message: "Kon spelerstatistieken niet opbouwen." });
    }

    const stats = buildPlayerStats(statsSource, { currentSeason, championCounts });

    notifyTeamsPlayerChange({ type: "created", name: player.name }).catch((error) => {
      console.error("Teams notificatie mislukt", error);
    });

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
    const existingPlayer = await prisma.player.findUnique({ where: { id: playerId } });

    if (!existingPlayer) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    const updatedPlayer = await prisma.player.update({
      where: { id: playerId },
      data: { name: name.trim() }
    });

    const [playerWithRelations, currentSeason, championCounts] = await Promise.all([
      fetchPlayersWithRelations(playerId),
      getOrCreateSeasonForDate(new Date()),
      getChampionCounts()
    ]);

    const statsSource = playerWithRelations[0];
    if (!statsSource) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    const stats = buildPlayerStats(statsSource, { currentSeason, championCounts });

    notifyTeamsPlayerChange({
      type: "updated",
      name: updatedPlayer.name,
      previousName: existingPlayer.name
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
      where: { id: playerId }
    });

    if (!player) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    await prisma.$transaction([
      prisma.match.deleteMany({
        where: {
          OR: [{ playerOneId: playerId }, { playerTwoId: playerId }]
        }
      }),
      prisma.player.delete({ where: { id: playerId } })
    ]);

    notifyTeamsPlayerChange({ type: "deleted", name: player.name }).catch((error) => {
      console.error("Teams notificatie mislukt", error);
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/matches", async (_req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { playedAt: "desc" },
      include: matchInclude
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
          include: matchInclude
        });
      })
    );

    res.json(corrected.map(serializeMatch));
  } catch (error) {
    next(error);
  }
});

app.post("/api/matches", async (req, res, next) => {
  const { playerOneId, playerTwoId, playerOnePoints, playerTwoPoints, playedAt } = req.body ?? {};

  if (
    typeof playerOneId !== "number" ||
    typeof playerTwoId !== "number" ||
    typeof playerOnePoints !== "number" ||
    typeof playerTwoPoints !== "number"
  ) {
    return res.status(400).json({ message: "Ongeldige invoer." });
  }

  if (playerOneId === playerTwoId) {
    return res.status(400).json({ message: "Een speler kan niet tegen zichzelf spelen." });
  }

  if (playerOnePoints === playerTwoPoints) {
    return res.status(400).json({ message: "Een potje eindigt altijd met een winnaar." });
  }

  if (playerOnePoints < 0 || playerTwoPoints < 0) {
    return res.status(400).json({ message: "Scores kunnen niet negatief zijn." });
  }

  try {
    const [playerOne, playerTwo] = await Promise.all([
      prisma.player.findUnique({ where: { id: playerOneId } }),
      prisma.player.findUnique({ where: { id: playerTwoId } })
    ]);

    if (!playerOne || !playerTwo) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    const playedDate = playedAt ? new Date(playedAt) : new Date();
    const season = await getOrCreateSeasonForDate(playedDate);
    const winnerId = playerOnePoints > playerTwoPoints ? playerOneId : playerTwoId;

    const match = await prisma.match.create({
      data: {
        playerOneId,
        playerTwoId,
        playerOnePoints,
        playerTwoPoints,
        winnerId,
        playedAt: playedDate,
        seasonId: season.id
      },
      include: matchInclude
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
    playedAt
  } = req.body ?? {};

  try {
    const existing = await prisma.match.findUnique({
      where: { id: matchId }
    });

    if (!existing) {
      return res.status(404).json({ message: "Wedstrijd niet gevonden." });
    }

    const nextPlayerOneId =
      typeof playerOneId === "number" ? playerOneId : existing.playerOneId;
    const nextPlayerTwoId =
      typeof playerTwoId === "number" ? playerTwoId : existing.playerTwoId;
    const nextPlayerOnePoints =
      typeof playerOnePoints === "number" ? playerOnePoints : existing.playerOnePoints;
    const nextPlayerTwoPoints =
      typeof playerTwoPoints === "number" ? playerTwoPoints : existing.playerTwoPoints;

    if (nextPlayerOneId === nextPlayerTwoId) {
      return res.status(400).json({ message: "Een speler kan niet tegen zichzelf spelen." });
    }

    if (nextPlayerOnePoints === nextPlayerTwoPoints) {
      return res.status(400).json({ message: "Een potje eindigt altijd met een winnaar." });
    }

    if (nextPlayerOnePoints < 0 || nextPlayerTwoPoints < 0) {
      return res.status(400).json({ message: "Scores kunnen niet negatief zijn." });
    }

    const [playerOne, playerTwo] = await Promise.all([
      prisma.player.findUnique({ where: { id: nextPlayerOneId } }),
      prisma.player.findUnique({ where: { id: nextPlayerTwoId } })
    ]);

    if (!playerOne || !playerTwo) {
      return res.status(404).json({ message: "Speler niet gevonden." });
    }

    const nextPlayedAt = playedAt ? new Date(playedAt) : existing.playedAt;
    const season = await getOrCreateSeasonForDate(nextPlayedAt);
    const winnerId = nextPlayerOnePoints > nextPlayerTwoPoints ? nextPlayerOneId : nextPlayerTwoId;

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: {
        playerOneId: nextPlayerOneId,
        playerTwoId: nextPlayerTwoId,
        playerOnePoints: nextPlayerOnePoints,
        playerTwoPoints: nextPlayerTwoPoints,
        winnerId,
        playedAt: nextPlayedAt,
        seasonId: season.id
      },
      include: matchInclude
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
      include: matchInclude
    });

    if (!existing) {
      return res.status(404).json({ message: "Wedstrijd niet gevonden." });
    }

    await prisma.match.delete({
      where: { id: matchId }
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
            include: matchInclude
          },
          champion: true
        }
      }),
      getOrCreateSeasonForDate(new Date())
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
              data: { championId }
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
            pointDifferential: entry.pointDifferential
          }))
        };
      })
    );

    res.json({
      currentSeasonId: currentSeason.id,
      seasons: seasonPayload
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
