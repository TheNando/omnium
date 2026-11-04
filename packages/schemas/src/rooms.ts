import { z } from "zod";

/** Appwrite ids shared by the client, the Functions and appwrite.config.json. */
export const ROOMS_DATABASE_ID = "rooms";
export const ROOMS_TABLE_ID = "rooms";
export const MEMBERS_TABLE_ID = "members";
export const ROOMS_FUNCTION_ID = "rooms";

export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const ROOM_CODE_LENGTH = 4;
/** A-Z and 0-9 without the look-alikes 0, O, 1, I and L (31 characters). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Per-app rules. A new app adds one entry; the `rooms` Function stays generic. */
export const APP_RULES = {
  shogun: {
    slots: ["red", "orange", "green", "blue", "purple"],
    minSlotsToStart: 2,
  },
} as const satisfies Record<string, { slots: readonly string[]; minSlotsToStart: number }>;

export type AppId = keyof typeof APP_RULES;

export const appIdSchema = z.enum(Object.keys(APP_RULES) as [AppId, ...AppId[]]);

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  return (
    code.length === ROOM_CODE_LENGTH &&
    code.split("").every((char) => ROOM_CODE_ALPHABET.includes(char))
  );
}

/** `random` returns a number in [0, 1), like Math.random. */
export function generateRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export const roomCodeSchema = z
  .string()
  .transform(normalizeRoomCode)
  .refine(isValidRoomCode, "Enter a 4-character room code.");

export const playerNameSchema = z.string().trim().min(1, "Enter a name.").max(20, "Name too long.");

export const roomStatusSchema = z.enum(["lobby", "started"]);
export type RoomStatus = z.infer<typeof roomStatusSchema>;

/** `data` holds app-specific JSON, stored as text. */
const rowBase = { $id: z.string(), $createdAt: z.string(), $updatedAt: z.string() };

export const roomSchema = z.object({
  ...rowBase,
  app: appIdSchema,
  ownerId: z.string(),
  status: roomStatusSchema,
  expiresAt: z.string(),
  data: z.string(),
});
export type Room = z.infer<typeof roomSchema>;

export const memberSchema = z.object({
  ...rowBase,
  roomId: z.string(),
  userId: z.string(),
  name: z.string(),
  slot: z.string().nullable(),
  ready: z.boolean(),
  data: z.string(),
});
export type Member = z.infer<typeof memberSchema>;

const code = { code: roomCodeSchema };

/** Body of an execution of the `rooms` Function. */
export const roomActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), app: appIdSchema, name: playerNameSchema }),
  z.object({ action: z.literal("join"), app: appIdSchema, name: playerNameSchema, ...code }),
  z.object({ action: z.literal("claimSlot"), slot: z.string(), ...code }),
  z.object({ action: z.literal("releaseSlot"), ...code }),
  z.object({ action: z.literal("unassign"), memberId: z.string(), ...code }),
  z.object({ action: z.literal("setReady"), ready: z.boolean(), ...code }),
  z.object({
    action: z.literal("updateData"),
    scope: z.enum(["room", "member"]),
    data: z.record(z.string(), z.unknown()),
    ...code,
  }),
  z.object({ action: z.literal("start"), ...code }),
  z.object({ action: z.literal("delete"), ...code }),
]);
export type RoomAction = z.infer<typeof roomActionSchema>;

export const roomErrorCodeSchema = z.enum([
  "invalid_request",
  "not_found",
  "forbidden",
  "conflict",
  "unauthorized",
  "internal",
]);
export type RoomErrorCode = z.infer<typeof roomErrorCodeSchema>;

/** Response body of the `rooms` Function. */
export const roomActionResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), code: z.string() }),
  z.object({ ok: z.literal(false), error: roomErrorCodeSchema, message: z.string() }),
]);
export type RoomActionResult = z.infer<typeof roomActionResultSchema>;
