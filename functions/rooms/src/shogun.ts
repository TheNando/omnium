import {
  ARMY_SHAPES,
  drawTurnOrder,
  type ArmyShape,
  type Battle,
  type GameState,
} from "@omnium/schemas";
import { fail, type Failure } from "./rules.ts";

/**
 * Pure Shogun round rules. A round has two phases. In "orders" each player locks at most
 * one battle per army, then clicks Done. When everyone is done the locked battles run one
 * at a time ("battles"), by player order and then army order. When none are left, the next
 * round starts with a freshly drawn player order. Nothing here touches Appwrite.
 */
export type Players = {
  /** User ids of everyone who picked a colour. */
  ids: string[];
  /** Whether that player still has that army on the board. */
  hasArmy: (userId: string, shape: ArmyShape) => boolean;
  random?: () => number;
};
export type Step = { ok: true; state: GameState } | Failure;

const ok = (state: GameState): Step => ({ ok: true, state });

export function startGame(players: Players): GameState {
  const order = drawTurnOrder(players.ids, {}, players.random);
  return { round: 1, phase: "orders", order, done: [], battles: [] };
}

/** Drops battles whose armies are gone, and starts the next round once none are left. */
function settle(state: GameState, players: Players): GameState {
  const battles = state.battles.filter(
    (battle) =>
      players.hasArmy(battle.attacker, battle.from) &&
      players.hasArmy(battle.defender, battle.target),
  );
  if (battles.length > 0) return { ...state, battles };
  return {
    round: state.round + 1,
    phase: "orders",
    order: drawTurnOrder(players.ids, {}, players.random),
    done: [],
    battles: [],
  };
}

function requireOrders(state: GameState, players: Players, userId: string): Failure | undefined {
  if (!players.ids.includes(userId)) return fail("forbidden", "Only players can do that.");
  if (state.phase !== "orders") return fail("conflict", "Orders are closed for this round.");
  if (state.done.includes(userId)) return fail("conflict", "You already clicked Done.");
  return undefined;
}

export function lockBattle(
  state: GameState,
  players: Players,
  userId: string,
  choice: Pick<Battle, "from" | "defender" | "target">,
): Step {
  const refused = requireOrders(state, players, userId);
  if (refused) return refused;
  if (choice.defender === userId) return fail("invalid_request", "You cannot attack yourself.");
  if (!players.ids.includes(choice.defender)) {
    return fail("invalid_request", "That player is not in the game.");
  }
  if (!players.hasArmy(userId, choice.from) || !players.hasArmy(choice.defender, choice.target)) {
    return fail("invalid_request", "That army is not on the board.");
  }
  const others = state.battles.filter(
    (battle) => !(battle.attacker === userId && battle.from === choice.from),
  );
  const { from, defender, target } = choice;
  return ok({ ...state, battles: [...others, { attacker: userId, from, defender, target }] });
}

export function cancelBattle(
  state: GameState,
  players: Players,
  userId: string,
  from: ArmyShape,
): Step {
  const refused = requireOrders(state, players, userId);
  if (refused) return refused;
  const battles = state.battles.filter(
    (battle) => !(battle.attacker === userId && battle.from === from),
  );
  return ok({ ...state, battles });
}

export function finishOrders(state: GameState, players: Players, userId: string): Step {
  if (!players.ids.includes(userId)) return fail("forbidden", "Only players can do that.");
  if (state.phase !== "orders") return fail("conflict", "Orders are closed for this round.");
  const done = state.done.includes(userId) ? state.done : [...state.done, userId];
  if (!players.ids.every((id) => done.includes(id))) return ok({ ...state, done });

  const rank = (battle: Battle) =>
    state.order.indexOf(battle.attacker) * ARMY_SHAPES.length + ARMY_SHAPES.indexOf(battle.from);
  const battles = [...state.battles].sort((a, b) => rank(a) - rank(b));
  return ok(settle({ ...state, done, phase: "battles", battles }, players));
}

/** Placeholder until battles resolve: the attacker or defender ends the battle in progress. */
export function endBattle(state: GameState, players: Players, userId: string): Step {
  const current = state.battles[0];
  if (state.phase !== "battles" || !current) return fail("conflict", "No battle in progress.");
  if (userId !== current.attacker && userId !== current.defender) {
    return fail("forbidden", "Only the two players in the battle can end it.");
  }
  return ok(settle({ ...state, battles: state.battles.slice(1) }, players));
}
