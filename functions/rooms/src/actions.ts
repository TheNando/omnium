import { ID, type TablesDB } from "node-appwrite";
import {
  MEMBERS_TABLE_ID,
  ROOMS_DATABASE_ID,
  ROOMS_TABLE_ID,
  ROOM_TTL_MS,
  EMPTY,
  generateRoomCode,
  ordersOf,
  parseMemberData,
  readGameState,
  roomStateOf,
  startingMemberData,
  type GameState,
  type Member,
  type Room,
  type RoomAction,
  type RoomActionResult,
} from "@omnium/schemas";
import { deleteRoom, getRoom, hasStatus, listMembers } from "./db.ts";
import {
  cancelBattle,
  endBattle,
  finishOrders,
  lockBattle,
  startGame,
  type Players,
  type Step,
} from "./shogun.ts";
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

/** Players are members with a colour. An army is on the board while it has any unit left. */
function shogunPlayers(members: Member[]): Players {
  const players = members.filter((member) => member.slot !== null);
  return {
    ids: players.map((member) => member.userId),
    hasArmy: (userId, shape) => {
      const player = players.find((member) => member.userId === userId);
      const army = player && parseMemberData(player.data)?.armies[shape];
      // A game started before armies existed has no data, so nothing can be locked.
      return army ? army.grid.replaceAll(EMPTY, "").length > 0 : false;
    },
  };
}

const noGame: RoomActionResult = {
  ok: false,
  error: "conflict",
  message: "There is no game in progress.",
};

function readRound(room: Room, members: Member[]) {
  const state = readGameState(room.data, members);
  if (room.app !== "shogun" || room.status !== "started" || !state) return undefined;
  return { state, players: shogunPlayers(members) };
}

const saveRoomState = (db: TablesDB, code: string, state: GameState) =>
  db.updateRow({
    ...location,
    tableId: ROOMS_TABLE_ID,
    rowId: code,
    data: { data: JSON.stringify(roomStateOf(state)) },
  });

/** Saves only this player's orders, so other players' saves cannot overwrite them. */
async function saveOrders(db: TablesDB, members: Member[], userId: string, state: GameState) {
  const member = members.find((each) => each.userId === userId);
  const saved = member && parseMemberData(member.data);
  if (!member || !saved) return;
  const data = JSON.stringify({ ...saved, orders: ordersOf(state, userId) });
  await updateMember(db, member.$id, { data });
}

/** Applies one round rule and saves the result to the room or to the player's own row. */
async function runRound(
  db: TablesDB,
  room: Room,
  members: Member[],
  userId: string,
  step: (state: GameState, players: Players) => Step,
  saveTo: "room" | "orders",
): Promise<RoomActionResult> {
  const round = readRound(room, members);
  if (!round) return noGame;
  const result = step(round.state, round.players);
  if (!result.ok) return result;
  if (saveTo === "room") await saveRoomState(db, room.$id, result.state);
  else await saveOrders(db, members, userId, result.state);
  return done(room.$id);
}

/**
 * Saves this player's Done, then re-reads every player. When two players click Done at
 * the same time, at least one of them sees both, and that one closes the orders phase.
 */
async function finishRoundOrders(
  db: TablesDB,
  room: Room,
  members: Member[],
  userId: string,
): Promise<RoomActionResult> {
  const round = readRound(room, members);
  if (!round) return noGame;
  const marked = finishOrders(round.state, round.players, userId);
  if (!marked.ok) return marked;
  await saveOrders(db, members, userId, { ...round.state, done: [...round.state.done, userId] });

  const fresh = readRound(room, await listMembers(db, room.$id));
  if (!fresh) return noGame;
  const closed = finishOrders(fresh.state, fresh.players, userId);
  if (closed.ok && (closed.state.phase !== "orders" || closed.state.round !== fresh.state.round)) {
    await saveRoomState(db, room.$id, closed.state);
  }
  return done(room.$id);
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
      let data = room.data;
      if (room.app === "shogun") {
        data = JSON.stringify(roomStateOf(startGame(shogunPlayers(members))));
        const armies = JSON.stringify(startingMemberData());
        await Promise.all(
          members
            .filter((member) => member.slot !== null)
            .map((member) => updateMember(db, member.$id, { data: armies })),
        );
      }
      await db.updateRow({
        ...location,
        tableId: ROOMS_TABLE_ID,
        rowId: code,
        data: { status: "started", data },
      });
      return done(code);
    }
    case "lockBattle":
      return runRound(
        db,
        room,
        members,
        userId,
        (state, players) => lockBattle(state, players, userId, action),
        "orders",
      );
    case "cancelBattle":
      return runRound(
        db,
        room,
        members,
        userId,
        (state, players) => cancelBattle(state, players, userId, action.from),
        "orders",
      );
    case "finishOrders":
      return finishRoundOrders(db, room, members, userId);
    case "endBattle":
      return runRound(
        db,
        room,
        members,
        userId,
        (state, players) => endBattle(state, players, userId),
        "room",
      );
    case "delete": {
      const check = checkDelete(room, userId);
      if (!check.ok) return check;
      await deleteRoom(db, code);
      return done(code);
    }
  }
}
