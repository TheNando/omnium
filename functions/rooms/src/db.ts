import { AppwriteException, Client, Query, TablesDB } from "node-appwrite";
import {
  MEMBERS_TABLE_ID,
  ROOMS_DATABASE_ID,
  ROOMS_TABLE_ID,
  memberSchema,
  roomSchema,
  type Member,
  type Room,
} from "@omnium/schemas";

/**
 * The API address as seen from inside the Function's container. Appwrite supplies
 * one, but on self-hosted setups it can be unreachable; set the Function variable
 * ROOMS_API_ENDPOINT (for example http://appwrite/v1) to override it.
 */
export const apiEndpoint = (): string | undefined =>
  process.env["ROOMS_API_ENDPOINT"] ?? process.env["APPWRITE_FUNCTION_API_ENDPOINT"];

export function createDb(endpoint: string, projectId: string, apiKey: string): TablesDB {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return new TablesDB(client);
}

export const hasStatus = (error: unknown, status: number): boolean =>
  error instanceof AppwriteException && error.code === status;

export async function getRoom(db: TablesDB, code: string): Promise<Room | null> {
  try {
    const row = await db.getRow({
      databaseId: ROOMS_DATABASE_ID,
      tableId: ROOMS_TABLE_ID,
      rowId: code,
    });
    return roomSchema.parse(row);
  } catch (error) {
    if (hasStatus(error, 404)) return null;
    throw error;
  }
}

export async function listMembers(db: TablesDB, code: string): Promise<Member[]> {
  const { rows } = await db.listRows({
    databaseId: ROOMS_DATABASE_ID,
    tableId: MEMBERS_TABLE_ID,
    queries: [Query.equal("roomId", [code]), Query.limit(500)],
  });
  return rows.map((row) => memberSchema.parse(row));
}

export async function deleteRoom(db: TablesDB, code: string): Promise<void> {
  // deleteRows removes one batch per call, so repeat until nothing is left.
  for (let batch = 0; batch < 20; batch++) {
    const { rows } = await db.deleteRows({
      databaseId: ROOMS_DATABASE_ID,
      tableId: MEMBERS_TABLE_ID,
      queries: [Query.equal("roomId", [code])],
    });
    if (rows.length === 0) break;
  }
  try {
    await db.deleteRow({ databaseId: ROOMS_DATABASE_ID, tableId: ROOMS_TABLE_ID, rowId: code });
  } catch (error) {
    if (!hasStatus(error, 404)) throw error;
  }
}
