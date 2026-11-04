import { ID, type TablesDB } from "node-appwrite";
import {
  MEMBERS_TABLE_ID,
  ROOMS_DATABASE_ID,
  ROOMS_TABLE_ID,
  ROOM_TTL_MS,
  generateRoomCode,
  type Room,
  type RoomAction,
  type RoomActionResult,
} from "@omnium/schemas";
import { deleteRoom, getRoom, hasStatus, listMembers } from "./db.ts";
import {
  checkClaimSlot,
  checkDelete,
  checkReleaseSlot,
  checkSetReady,
  checkStart,
  checkUnassign,
  checkUpdateData,
  isExpired,
} from "./rules.ts";

const MAX_DATA_LENGTH = 4000;
const location = { databaseId: ROOMS_DATABASE_ID };

const done = (code: string): RoomActionResult => ({ ok: true, code });
const notFound: RoomActionResult = { ok: false, error: "not_found", message: "Room not found." };

/** Returns the room, deleting it first if it has expired so its code is free again. */
async function loadRoom(db: TablesDB, code: string, now: Date): Promise<Room | null> {
  const room = await getRoom(db, code);
  if (room && isExpired(room, now)) {
    await deleteRoom(db, code);
    return null;
  }
  return room;
}

const updateMember = (db: TablesDB, rowId: string, data: Record<string, unknown>) =>
  db.updateRow({ ...location, tableId: MEMBERS_TABLE_ID, rowId, data });

const addMember = (db: TablesDB, roomId: string, userId: string, name: string) =>
  db.createRow({
    ...location,
    tableId: MEMBERS_TABLE_ID,
    rowId: ID.unique(),
    data: { roomId, userId, name, slot: null, ready: false, data: "{}" },
  });

async function createRoom(
  db: TablesDB,
  action: Extract<RoomAction, { action: "create" }>,
  userId: string,
  now: Date,
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRoomCode();
    if (await loadRoom(db, code, now)) continue;
    try {
      await db.createRow({
        ...location,
        tableId: ROOMS_TABLE_ID,
        rowId: code,
        data: {
          app: action.app,
          ownerId: userId,
          status: "lobby",
          expiresAt: new Date(now.getTime() + ROOM_TTL_MS).toISOString(),
          data: "{}",
        },
      });
    } catch (error) {
      if (hasStatus(error, 409)) continue;
      throw error;
    }
    await addMember(db, code, userId, action.name);
    return done(code);
  }
  return { ok: false, error: "conflict", message: "Could not find a free room code." } as const;
}

export async function runAction(
  db: TablesDB,
  action: RoomAction,
  userId: string,
  now: Date,
): Promise<RoomActionResult> {
  if (action.action === "create") return createRoom(db, action, userId, now);

  const room = await loadRoom(db, action.code, now);
  if (!room) return notFound;
  const code = room.$id;
  const members = await listMembers(db, code);

  switch (action.action) {
    case "join": {
      if (room.app !== action.app) return notFound;
      const existing = members.find((member) => member.userId === userId);
      if (!existing) await addMember(db, code, userId, action.name);
      else if (existing.name !== action.name)
        await updateMember(db, existing.$id, { name: action.name });
      return done(code);
    }
    case "claimSlot": {
      const check = checkClaimSlot(room, members, userId, action.slot);
      if (!check.ok) return check;
      if (check.member.slot === action.slot) return done(code);
      try {
        await updateMember(db, check.member.$id, { slot: action.slot, ready: false });
      } catch (error) {
        // The unique (roomId, slot) index caught a simultaneous claim.
        if (hasStatus(error, 409))
          return { ok: false, error: "conflict", message: "That army is already taken." };
        throw error;
      }
      return done(code);
    }
    case "releaseSlot": {
      const check = checkReleaseSlot(room, members, userId);
      if (!check.ok) return check;
      await updateMember(db, check.member.$id, { slot: null, ready: false });
      return done(code);
    }
    case "unassign": {
      const check = checkUnassign(room, members, userId, action.memberId);
      if (!check.ok) return check;
      await updateMember(db, check.member.$id, { slot: null, ready: false });
      return done(code);
    }
    case "setReady": {
      const check = checkSetReady(room, members, userId, action.ready);
      if (!check.ok) return check;
      await updateMember(db, check.member.$id, { ready: action.ready });
      return done(code);
    }
    case "updateData": {
      const check = checkUpdateData(room, members, userId, action.scope);
      if (!check.ok) return check;
      const data = JSON.stringify(action.data);
      if (data.length > MAX_DATA_LENGTH)
        return { ok: false, error: "invalid_request", message: "Data too large." };
      if (check.member) await updateMember(db, check.member.$id, { data });
      else
        await db.updateRow({ ...location, tableId: ROOMS_TABLE_ID, rowId: code, data: { data } });
      return done(code);
    }
    case "start": {
      const check = checkStart(room, members, userId);
      if (!check.ok) return check;
      await db.updateRow({
        ...location,
        tableId: ROOMS_TABLE_ID,
        rowId: code,
        data: { status: "started" },
      });
      return done(code);
    }
    case "delete": {
      const check = checkDelete(room, userId);
      if (!check.ok) return check;
      await deleteRoom(db, code);
      return done(code);
    }
  }
}
