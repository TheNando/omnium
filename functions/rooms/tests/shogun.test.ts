import { describe, expect, test } from "vite-plus/test";
import {
  drawTurnOrder,
  ordersOf,
  readGameState,
  roomStateOf,
  startingMemberData,
  type GameState,
  type Orders,
} from "@omnium/schemas";
import {
  cancelBattle,
  endBattle,
  finishOrders,
  lockBattle,
  startGame,
  type Players,
  type Step,
} from "../src/shogun.ts";

const players = (overrides: Partial<Players> = {}): Players => ({
  ids: ["ann", "bob", "cat"],
  hasArmy: () => true,
  random: () => 0,
  ...overrides,
});

const orders = (overrides: Partial<GameState> = {}): GameState => ({
  round: 1,
  phase: "orders",
  order: ["bob", "ann", "cat"],
  done: [],
  battles: [],
  ...overrides,
});

const stateOf = (step: Step): GameState => {
  if (!step.ok) throw new Error(step.message);
  return step.state;
};
const errorOf = (step: Step) => (step.ok ? undefined : step.error);

describe("drawTurnOrder", () => {
  test("puts bidders first, highest bid first, then the rest", () => {
    const order = drawTurnOrder(["a", "b", "c", "d"], { c: 1, a: 3 }, () => 0);
    expect(order.slice(0, 2)).toEqual(["a", "c"]);
    expect(order.slice(2).sort()).toEqual(["b", "d"]);
  });
  test("includes every player exactly once", () => {
    expect(drawTurnOrder(["a", "b", "c"]).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("startGame", () => {
  test("opens round 1 in the orders phase", () => {
    const state = startGame(players());
    expect(state).toMatchObject({ round: 1, phase: "orders", done: [], battles: [] });
    expect([...state.order].sort()).toEqual(["ann", "bob", "cat"]);
  });
});

describe("lockBattle", () => {
  const choice = { from: "circle", defender: "bob", target: "hexagon" } as const;

  test("locks a battle for one of your armies, keeping only the battle fields", () => {
    const action = { action: "lockBattle", code: "ABCD", ...choice };
    const state = stateOf(lockBattle(orders(), players(), "ann", action));
    expect(state.battles).toEqual([{ attacker: "ann", ...choice }]);
  });
  test("replaces the earlier lock for the same army", () => {
    const first = stateOf(lockBattle(orders(), players(), "ann", choice));
    const second = stateOf(
      lockBattle(first, players(), "ann", { ...choice, defender: "cat", target: "circle" }),
    );
    expect(second.battles).toEqual([
      { attacker: "ann", from: "circle", defender: "cat", target: "circle" },
    ]);
  });
  test("lets one player lock all three armies, and a player be attacked many times", () => {
    let state = orders();
    for (const from of ["circle", "diamond", "hexagon"] as const) {
      state = stateOf(lockBattle(state, players(), "ann", { ...choice, from }));
    }
    state = stateOf(lockBattle(state, players(), "cat", choice));
    expect(state.battles).toHaveLength(4);
  });
  test("refuses attacking yourself, spectators and missing armies", () => {
    expect(errorOf(lockBattle(orders(), players(), "ann", { ...choice, defender: "ann" }))).toBe(
      "invalid_request",
    );
    expect(errorOf(lockBattle(orders(), players(), "eve", choice))).toBe("forbidden");
    expect(errorOf(lockBattle(orders(), players(), "ann", { ...choice, defender: "eve" }))).toBe(
      "invalid_request",
    );
    const gone = players({ hasArmy: (id, shape) => !(id === "bob" && shape === "hexagon") });
    expect(errorOf(lockBattle(orders(), gone, "ann", choice))).toBe("invalid_request");
  });
  test("refuses locks after Done and outside the orders phase", () => {
    expect(errorOf(lockBattle(orders({ done: ["ann"] }), players(), "ann", choice))).toBe(
      "conflict",
    );
    expect(errorOf(lockBattle(orders({ phase: "battles" }), players(), "ann", choice))).toBe(
      "conflict",
    );
  });
});

describe("cancelBattle", () => {
  test("removes only that army's lock", () => {
    const battles = [
      { attacker: "ann", from: "circle", defender: "bob", target: "circle" },
      { attacker: "ann", from: "diamond", defender: "bob", target: "circle" },
    ] as const;
    const state = stateOf(
      cancelBattle(orders({ battles: [...battles] }), players(), "ann", "circle"),
    );
    expect(state.battles).toEqual([battles[1]]);
  });
});

describe("finishOrders", () => {
  const battle = (attacker: string, from: "circle" | "diamond" | "hexagon", defender: string) =>
    ({ attacker, from, defender, target: "circle" }) as const;

  test("waits until every player is done", () => {
    const state = stateOf(finishOrders(orders(), players(), "ann"));
    expect(state).toMatchObject({ phase: "orders", done: ["ann"] });
    expect(stateOf(finishOrders(state, players(), "ann")).done).toEqual(["ann"]);
  });
  test("starts battles in player order, then army order", () => {
    const state = orders({
      done: ["ann", "bob"],
      battles: [
        battle("ann", "circle", "bob"),
        battle("bob", "hexagon", "cat"),
        battle("bob", "circle", "cat"),
        battle("cat", "diamond", "ann"),
      ],
    });
    const next = stateOf(finishOrders(state, players(), "cat"));
    expect(next.phase).toBe("battles");
    expect(next.battles.map((b) => `${b.attacker}:${b.from}`)).toEqual([
      "bob:circle",
      "bob:hexagon",
      "ann:circle",
      "cat:diamond",
    ]);
  });
  test("goes straight to the next round when nothing was locked", () => {
    const next = stateOf(finishOrders(orders({ done: ["ann", "bob"] }), players(), "cat"));
    expect(next).toMatchObject({ round: 2, phase: "orders", done: [], battles: [] });
  });
});

describe("endBattle", () => {
  const queue = [
    { attacker: "bob", from: "circle", defender: "ann", target: "circle" },
    { attacker: "cat", from: "circle", defender: "ann", target: "diamond" },
  ] as const;
  const running = (): GameState => orders({ phase: "battles", battles: [...queue] });

  test("lets only the attacker or defender end the current battle", () => {
    expect(errorOf(endBattle(running(), players(), "cat"))).toBe("forbidden");
    expect(stateOf(endBattle(running(), players(), "ann")).battles).toEqual([queue[1]]);
    expect(stateOf(endBattle(running(), players(), "bob")).battles).toEqual([queue[1]]);
  });
  test("starts the next round after the last battle", () => {
    const last = orders({ phase: "battles", battles: [queue[0]] });
    expect(stateOf(endBattle(last, players(), "bob"))).toMatchObject({
      round: 2,
      phase: "orders",
      done: [],
      battles: [],
    });
  });
  test("skips queued battles whose armies are gone", () => {
    const gone = players({ hasArmy: (id, shape) => !(id === "ann" && shape === "diamond") });
    const last = stateOf(endBattle(running(), gone, "bob"));
    expect(last).toMatchObject({ round: 2, phase: "orders", battles: [] });
  });
  test("refuses when no battle is in progress", () => {
    expect(errorOf(endBattle(orders(), players(), "ann"))).toBe("conflict");
  });
});

describe("saved state", () => {
  const armies = startingMemberData().armies;
  const member = (userId: string, orders?: Orders) => ({
    userId,
    data: JSON.stringify({ armies, orders }),
  });
  const lock = { from: "circle", defender: "bob", target: "hexagon" } as const;
  const room = (state: Partial<GameState> = {}) => JSON.stringify(roomStateOf(orders(state)));

  test("collects each player's locks and Done for the current round only", () => {
    const state = readGameState(room({ round: 2 }), [
      member("ann", { round: 2, locks: [lock], done: true }),
      member("bob", { round: 1, locks: [{ ...lock, defender: "ann" }], done: true }),
      member("cat"),
    ]);
    expect(state?.battles).toEqual([{ attacker: "ann", ...lock }]);
    expect(state?.done).toEqual(["ann"]);
  });
  test("uses the room's queue, not the players' locks, during battles", () => {
    const queue = [
      { attacker: "bob", from: "diamond", defender: "ann", target: "circle" },
    ] as const;
    const state = readGameState(room({ phase: "battles", battles: [...queue] }), [
      member("ann", { round: 1, locks: [lock], done: true }),
    ]);
    expect(state?.battles).toEqual(queue);
  });
  test("saves locks per player and the queue on the room only during battles", () => {
    const state = orders({ battles: [{ attacker: "ann", ...lock }], done: ["ann"] });
    expect(ordersOf(state, "ann")).toEqual({ round: 1, locks: [lock], done: true });
    expect(ordersOf(state, "bob")).toEqual({ round: 1, locks: [], done: false });
    expect(roomStateOf(state)).not.toHaveProperty("done");
    expect(roomStateOf(state).battles).toEqual([]);
  });
});
