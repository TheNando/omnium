import { z } from "zod";

/** Army shapes. A player's three armies are named after the shape on their banner. */
export const ARMY_SHAPES = ["circle", "diamond", "hexagon"] as const;
export type ArmyShape = (typeof ARMY_SHAPES)[number];
export const armyShapeSchema = z.enum(ARMY_SHAPES);

export const SHOGUN_COLORS = ["red", "orange", "green", "blue", "purple"] as const;
export type ShogunColor = (typeof SHOGUN_COLORS)[number];

/** Army names per colour, in banner order (circle, diamond, hexagon). */
export const ARMY_NAMES: Record<ShogunColor, Record<ArmyShape, string>> = {
  red: { circle: "Uesugi", diamond: "Fukushima", hexagon: "Oda" },
  orange: { circle: "Ogawa", diamond: "Kobayakawa", hexagon: "Shimazu" },
  green: { circle: "Maeda", diamond: "Tokugawa", hexagon: "Asano" },
  purple: { circle: "Mori", diamond: "Chosokabe", hexagon: "Ukita" },
  blue: { circle: "Konishi", diamond: "Takahashi", hexagon: "Ota" },
};

/** One letter per unit in a saved grid. "." is an empty spot. Ronin are samurai (rulebook p.6). */
export const UNITS = {
  D: { name: "Daimyo", value: 6, icon: "daimyo" },
  B: { name: "Bowman", value: 6, icon: "bowman" },
  S: { name: "Swordsman", value: 5, icon: "swordsman" },
  R: { name: "Ronin", value: 5, icon: "ronin" },
  G: { name: "Gunner", value: 4, icon: "gunner" },
  P: { name: "Spearman", value: 4, icon: "spearman" },
} as const;
export type UnitCode = keyof typeof UNITS;
export const EMPTY = ".";

/** Each army card is 3 rows of 5. Row 1 is the daimyo plus four samurai spots; rows 2-3 are ashigaru. */
export const GRID_COLUMNS = 5;
export const GRID_SIZE = 15;
export const SAMURAI_SPOTS = [1, 2, 3, 4] as const;
export const ASHIGARU_SPOTS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
export const SPOT_HINTS = ["D", "S", "S", "S", "S", ...Array<string>(10).fill("A")];

/** Starting army: 1 daimyo, 1 bowman, 1 swordsman and 2 gunners. */
export const STARTING_GRID = ["DBS..", "GG...", "....."].join("");

/** The level bar has 8 spots, one per win (capped). The label is the army's level. */
export const LEVEL_TRACK = [1, 1, 1, 2, 2, 3, 3, 4] as const;
export const levelOf = (wins: number): number =>
  LEVEL_TRACK[Math.min(Math.max(wins, 0), LEVEL_TRACK.length - 1)] ?? 1;

const gridSchema = z.string().length(GRID_SIZE);
const armySchema = z.object({ wins: z.number().int().min(0), grid: gridSchema });
export type Army = z.infer<typeof armySchema>;

/** One army's locked battle, as the attacker saves it. */
const lockSchema = z.object({
  from: armyShapeSchema,
  defender: z.string(),
  target: armyShapeSchema,
});

/** A player's locks and Done for one round. Orders from an earlier round are ignored. */
const ordersSchema = z.object({
  round: z.number().int().min(1),
  locks: z.array(lockSchema),
  done: z.boolean(),
});
export type Orders = z.infer<typeof ordersSchema>;

/**
 * A player's saved data (`member.data`), created when the game starts. Each player's orders
 * live here rather than in the room, so players locking at the same time never overwrite
 * each other.
 */
export const memberDataSchema = z.object({
  armies: z.object({ circle: armySchema, diamond: armySchema, hexagon: armySchema }),
  orders: ordersSchema.optional(),
});
export type ShogunMemberData = z.infer<typeof memberDataSchema>;

export const startingMemberData = (): ShogunMemberData => ({
  armies: ARMY_SHAPES.reduce(
    (armies, shape) => ({ ...armies, [shape]: { wins: 0, grid: STARTING_GRID } }),
    {} as ShogunMemberData["armies"],
  ),
});

/** A locked battle: `from` is the attacker's army, `target` the defender's army. */
export const battleSchema = z.object({
  attacker: z.string(),
  from: armyShapeSchema,
  defender: z.string(),
  target: armyShapeSchema,
});
export type Battle = z.infer<typeof battleSchema>;

/**
 * The saved room state (`room.data`). `order` is who acts first this round, redrawn every
 * round. `battles` is only filled in the "battles" phase: it is the queue, and `battles[0]`
 * is the one in progress.
 */
const roomStateSchema = z.object({
  round: z.number().int().min(1),
  phase: z.enum(["orders", "battles"]),
  order: z.array(z.string()),
  battles: z.array(battleSchema),
});
export type RoomState = z.infer<typeof roomStateSchema>;

/**
 * The game state the round rules work on: the room state plus every player's orders for
 * this round. In the "orders" phase `battles` holds everyone's locked battles.
 */
export type GameState = RoomState & { done: string[] };

/** Returns undefined for empty or malformed data (for example a game started before armies existed). */
export function parseJson<T>(schema: z.ZodType<T>, text: string): T | undefined {
  try {
    const result = schema.safeParse(JSON.parse(text));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export const parseMemberData = (text: string) => parseJson(memberDataSchema, text);

/** Combines the room state with each player's orders for the current round. */
export function readGameState(
  roomData: string,
  members: { userId: string; data: string }[],
): GameState | undefined {
  const room = parseJson(roomStateSchema, roomData);
  if (!room) return undefined;
  const current = members.flatMap((member) => {
    const orders = parseMemberData(member.data)?.orders;
    return orders?.round === room.round ? [{ userId: member.userId, orders }] : [];
  });
  const done = current.filter(({ orders }) => orders.done).map(({ userId }) => userId);
  if (room.phase === "battles") return { ...room, done };
  const battles = current.flatMap(({ userId, orders }) =>
    orders.locks.map((lock) => ({ attacker: userId, ...lock })),
  );
  return { ...room, done, battles };
}

/** The part of the game state saved on the room. */
export const roomStateOf = ({ round, phase, order, battles }: GameState): RoomState => ({
  round,
  phase,
  order,
  battles: phase === "battles" ? battles : [],
});

/** The part of the game state one player saves on their own member row. */
export const ordersOf = (state: GameState, userId: string): Orders => ({
  round: state.round,
  locks: state.battles
    .filter((battle) => battle.attacker === userId)
    .map(({ from, defender, target }) => ({ from, defender, target })),
  done: state.done.includes(userId),
});

/** Placeholder until koku bidding exists: every player is a non-bidder and draws at random. */
export function drawTurnOrder(
  players: string[],
  bids: Record<string, number> = {},
  random: () => number = Math.random,
): string[] {
  const shuffled = [...players];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!];
  }
  const bidders = shuffled.filter((id) => (bids[id] ?? 0) > 0);
  bidders.sort((a, b) => (bids[b] ?? 0) - (bids[a] ?? 0));
  return [...bidders, ...shuffled.filter((id) => !bidders.includes(id))];
}
