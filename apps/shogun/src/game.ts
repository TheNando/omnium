import {
  SHOGUN_COLORS,
  parseMemberData,
  readGameState,
  type ArmyShape,
  type Battle,
  type GameState,
  type Member,
  type Room,
  type ShogunColor,
  type ShogunMemberData,
} from "@omnium/schemas";

export type Player = {
  member: Member;
  color: ShogunColor;
  /** Undefined for a game that started before armies were saved. */
  armies: ShogunMemberData["armies"] | undefined;
};

export type Game = { state: GameState | undefined; players: Player[] };

export type View = "room" | "combat" | "battle";

const isColor = (slot: string): slot is ShogunColor =>
  SHOGUN_COLORS.some((color) => color === slot);

/** Reads the game state (room data plus each player's orders) and every player's armies. */
export function readGame(room: Room, members: Member[]): Game {
  const players = members.flatMap((member) =>
    member.slot !== null && isColor(member.slot)
      ? [{ member, color: member.slot, armies: parseMemberData(member.data)?.armies }]
      : [],
  );
  return { state: readGameState(room.data, members), players };
}

export const roomUrl = (code: string, view?: Exclude<View, "room">) =>
  `/?room=${code}${view ? `&view=${view}` : ""}`;

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The battle in progress, if any: the first in the queue once orders are done. */
export const currentBattle = (state: GameState | undefined): Battle | undefined =>
  state?.phase === "battles" ? state.battles[0] : undefined;

export const findPlayer = (game: Game, userId: string) =>
  game.players.find((player) => player.member.userId === userId);

export const lockFor = (state: GameState, userId: string, from: ArmyShape) =>
  state.battles.find((battle) => battle.attacker === userId && battle.from === from);
