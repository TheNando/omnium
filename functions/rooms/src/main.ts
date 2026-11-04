import { roomActionSchema, type RoomActionResult, type RoomErrorCode } from "@omnium/schemas";
import { runAction } from "./actions.ts";
import { apiEndpoint, createDb } from "./db.ts";

type Context = {
  req: { headers: Record<string, string | undefined>; bodyJson: unknown };
  res: { json: (body: unknown, status?: number) => unknown };
  error: (message: string) => void;
};

const STATUS: Record<RoomErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  internal: 500,
};

const fail = (error: RoomErrorCode, message: string): RoomActionResult => ({
  ok: false,
  error,
  message,
});

/** Entry point of the `rooms` Function. Every room write goes through here. */
export default async ({ req, res, error }: Context) => {
  const userId = req.headers["x-appwrite-user-id"];
  const apiKey = req.headers["x-appwrite-key"];
  const endpoint = apiEndpoint();
  const projectId = process.env["APPWRITE_FUNCTION_PROJECT_ID"];

  let result: RoomActionResult;
  const parsed = roomActionSchema.safeParse(req.bodyJson);
  if (!userId) {
    result = fail("unauthorized", "Sign in first.");
  } else if (!parsed.success) {
    result = fail("invalid_request", parsed.error.issues[0]?.message ?? "Invalid request.");
  } else if (!apiKey || !endpoint || !projectId) {
    error("Missing API key, endpoint or project id. Check the function's scopes.");
    result = fail("internal", "Server is misconfigured.");
  } else {
    try {
      result = await runAction(
        createDb(endpoint, projectId, apiKey),
        parsed.data,
        userId,
        new Date(),
      );
    } catch (cause) {
      error(`${String(cause)} (endpoint: ${endpoint})`);
      return res.json(fail("internal", "Something went wrong."), 500);
    }
  }
  return res.json(result, result.ok ? 200 : STATUS[result.error]);
};
