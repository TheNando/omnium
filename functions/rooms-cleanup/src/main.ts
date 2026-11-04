import { Query } from "node-appwrite";
import { ROOMS_DATABASE_ID, ROOMS_TABLE_ID } from "@omnium/schemas";
import { apiEndpoint, createDb, deleteRoom } from "../../rooms/src/db.ts";

type Context = {
  req: { headers: Record<string, string | undefined> };
  res: { json: (body: unknown, status?: number) => unknown };
  log: (message: string) => void;
  error: (message: string) => void;
};

/** Runs hourly (see appwrite.config.json) and deletes rooms past their `expiresAt`. */
export default async ({ req, res, log, error }: Context) => {
  const apiKey = req.headers["x-appwrite-key"];
  const endpoint = apiEndpoint();
  const projectId = process.env["APPWRITE_FUNCTION_PROJECT_ID"];
  if (!apiKey || !endpoint || !projectId) {
    error("Missing API key, endpoint or project id. Check the function's scopes.");
    return res.json({ ok: false }, 500);
  }

  const db = createDb(endpoint, projectId, apiKey);
  let deleted = 0;
  for (let batch = 0; batch < 50; batch++) {
    const { rows } = await db.listRows({
      databaseId: ROOMS_DATABASE_ID,
      tableId: ROOMS_TABLE_ID,
      queries: [Query.lessThanEqual("expiresAt", new Date().toISOString()), Query.limit(100)],
    });
    if (rows.length === 0) break;
    for (const row of rows) await deleteRoom(db, row.$id);
    deleted += rows.length;
  }
  log(`Deleted ${deleted} expired room(s).`);
  return res.json({ ok: true, deleted });
};
