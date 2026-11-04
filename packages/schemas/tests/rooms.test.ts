import { describe, expect, test } from "vite-plus/test";
import {
  ROOM_CODE_ALPHABET,
  generateRoomCode,
  isValidRoomCode,
  playerNameSchema,
  roomActionSchema,
  roomCodeSchema,
} from "../src/index.ts";

describe("room codes", () => {
  test("the alphabet has 31 characters and no look-alikes", () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(31);
    for (const char of "01OIL") expect(ROOM_CODE_ALPHABET).not.toContain(char);
  });
  test("generated codes are 4 valid characters", () => {
    for (let index = 0; index < 200; index++)
      expect(isValidRoomCode(generateRoomCode())).toBe(true);
  });
  test("input is trimmed and uppercased; bad input is refused", () => {
    expect(roomCodeSchema.parse(" ab2c ")).toBe("AB2C");
    for (const bad of ["ABC", "ABCDE", "AB0C", "abil"])
      expect(roomCodeSchema.safeParse(bad).success).toBe(false);
  });
});

describe("player names and actions", () => {
  test("names are trimmed and limited to 20 characters", () => {
    expect(playerNameSchema.parse("  Takeda ")).toBe("Takeda");
    expect(playerNameSchema.safeParse("   ").success).toBe(false);
    expect(playerNameSchema.safeParse("x".repeat(21)).success).toBe(false);
  });
  test("actions normalise the room code", () => {
    const parsed = roomActionSchema.parse({
      action: "join",
      app: "shogun",
      name: "Ann",
      code: "ab2c",
    });
    expect(parsed).toMatchObject({ code: "AB2C" });
    expect(
      roomActionSchema.safeParse({ action: "join", app: "chess", name: "Ann", code: "AB2C" })
        .success,
    ).toBe(false);
  });
});
