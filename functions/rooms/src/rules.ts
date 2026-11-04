import { APP_RULES, type AppId, type RoomErrorCode, type RoomStatus } from "@omnium/schemas";

/**
 * Pure room rules. Each check takes the current rows and either approves the
 * change or returns an error. Nothing here reads or writes Appwrite.
 */
export type RoomRow = {
  $id: string;
  app: AppId;
  ownerId: string;
  status: RoomStatus;
  expiresAt: string;
};
export type MemberRow = { $id: string; userId: string; slot: string | null; ready: boolean };

export type Failure = { ok: false; error: RoomErrorCode; message: string };
export type Check<T = Record<never, never>> = ({ ok: true } & T) | Failure;

export const fail = (error: RoomErrorCode, message: string): Failure => ({
  ok: false,
  error,
  message,
});

export function isExpired(room: Pick<RoomRow, "expiresAt">, now: Date): boolean {
  return new Date(room.expiresAt).getTime() <= now.getTime();
}

function findMember(members: MemberRow[], userId: string): MemberRow | undefined {
  return members.find((member) => member.userId === userId);
}

function requireMember(members: MemberRow[], userId: string): Check<{ member: MemberRow }> {
  const member = findMember(members, userId);
  return member ? { ok: true, member } : fail("forbidden", "Join the room first.");
}

const requireLobby = (room: RoomRow): Failure | undefined =>
  room.status === "lobby" ? undefined : fail("conflict", "The game has already started.");

export function checkClaimSlot(
  room: RoomRow,
  members: MemberRow[],
  userId: string,
  slot: string,
): Check<{ member: MemberRow }> {
  const locked = requireLobby(room);
  if (locked) return locked;
  if (!(APP_RULES[room.app].slots as readonly string[]).includes(slot)) {
    return fail("invalid_request", "That army does not exist.");
  }
  const self = requireMember(members, userId);
  if (!self.ok) return self;
  if (members.some((member) => member.slot === slot && member.userId !== userId)) {
    return fail("conflict", "That army is already taken.");
  }
  return self;
}

export function checkReleaseSlot(room: RoomRow, members: MemberRow[], userId: string) {
  return requireLobby(room) ?? requireMember(members, userId);
}

export function checkUnassign(
  room: RoomRow,
  members: MemberRow[],
  userId: string,
  memberId: string,
): Check<{ member: MemberRow }> {
  if (room.ownerId !== userId) return fail("forbidden", "Only the room owner can do that.");
  const locked = requireLobby(room);
  if (locked) return locked;
  const member = members.find((candidate) => candidate.$id === memberId);
  return member ? { ok: true, member } : fail("not_found", "That player is not in the room.");
}

export function checkSetReady(
  room: RoomRow,
  members: MemberRow[],
  userId: string,
  ready: boolean,
): Check<{ member: MemberRow }> {
  const locked = requireLobby(room);
  if (locked) return locked;
  const self = requireMember(members, userId);
  if (!self.ok) return self;
  if (ready && self.member.slot === null) return fail("conflict", "Pick an army first.");
  return self;
}

export function checkStart(room: RoomRow, members: MemberRow[], userId: string): Check {
  if (room.ownerId !== userId) return fail("forbidden", "Only the room owner can do that.");
  const locked = requireLobby(room);
  if (locked) return locked;
  const players = members.filter((member) => member.slot !== null);
  if (players.length < APP_RULES[room.app].minSlotsToStart) {
    return fail("conflict", `At least ${APP_RULES[room.app].minSlotsToStart} armies are needed.`);
  }
  if (!players.every((player) => player.ready)) return fail("conflict", "Everyone must be ready.");
  return { ok: true };
}

export function checkDelete(room: RoomRow, userId: string): Check {
  return room.ownerId === userId
    ? { ok: true }
    : fail("forbidden", "Only the room owner can do that.");
}

/** Members write only their own data and only players (members with a slot) may. */
export function checkUpdateData(
  room: RoomRow,
  members: MemberRow[],
  userId: string,
  scope: "room" | "member",
): Check<{ member: MemberRow | null }> {
  if (scope === "room") {
    return room.ownerId === userId
      ? { ok: true, member: null }
      : fail("forbidden", "Only the room owner can do that.");
  }
  const self = requireMember(members, userId);
  if (!self.ok) return self;
  return self.member.slot === null
    ? fail("forbidden", "Spectators cannot change data.")
    : { ok: true, member: self.member };
}
