import { AppwriteException, Channel, ExecutionMethod, Query } from "appwrite";
import {
  MEMBERS_TABLE_ID,
  ROOMS_DATABASE_ID,
  ROOMS_FUNCTION_ID,
  ROOMS_TABLE_ID,
  memberSchema,
  roomActionResultSchema,
  roomSchema,
  type Member,
  type Room,
  type RoomAction,
  type RoomActionResult,
} from "@omnium/schemas";
import { appwrite } from "./client.ts";

/** Sends one action to the `rooms` Function, which is the only way to change a room. */
export async function runRoomAction(action: RoomAction): Promise<RoomActionResult> {
  const execution = await appwrite().functions.createExecution({
    functionId: ROOMS_FUNCTION_ID,
    body: JSON.stringify(action),
    async: false,
    method: ExecutionMethod.POST,
  });
  const parsed = roomActionResultSchema.safeParse(safeJson(execution.responseBody));
  return parsed.success
    ? parsed.data
    : { ok: false, error: "internal", message: "The server did not answer. Try again." };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Returns null when the room does not exist (or has been deleted or expired). */
export async function getRoom(code: string): Promise<Room | null> {
  try {
    const row = await appwrite().tables.getRow({
      databaseId: ROOMS_DATABASE_ID,
      tableId: ROOMS_TABLE_ID,
      rowId: code,
    });
    return roomSchema.parse(row);
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) return null;
    throw error;
  }
}

export async function listMembers(code: string): Promise<Member[]> {
  const { rows } = await appwrite().tables.listRows({
    databaseId: ROOMS_DATABASE_ID,
    tableId: MEMBERS_TABLE_ID,
    queries: [Query.equal("roomId", [code]), Query.orderAsc("$createdAt"), Query.limit(500)],
  });
  return rows.map((row) => memberSchema.parse(row));
}

/** Calls `onChange` whenever this room or one of its members changes. Returns an unsubscribe function. */
export function subscribeToRoom(code: string, onChange: () => void): () => void {
  const tables = Channel.tablesdb(ROOMS_DATABASE_ID);
  return appwrite().client.subscribe<{ roomId?: string }>(
    [tables.table(ROOMS_TABLE_ID).row(code), tables.table(MEMBERS_TABLE_ID).row()],
    (event) => {
      const isThisRoom = event.channels.some((channel) => channel.includes(`.rows.${code}`));
      if (isThisRoom || event.payload.roomId === code) onChange();
    },
  );
}
