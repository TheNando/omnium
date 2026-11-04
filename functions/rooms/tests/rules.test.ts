import { describe, expect, test } from "vite-plus/test";
import {
  checkClaimSlot,
  checkDelete,
  checkReleaseSlot,
  checkSetReady,
  checkStart,
  checkUnassign,
  checkUpdateData,
  isExpired,
  type Check,
  type MemberRow,
  type RoomRow,
} from "../src/rules.ts";

const room = (overrides: Partial<RoomRow> = {}): RoomRow => ({
  $id: "ABCD",
  app: "shogun",
  ownerId: "owner",
  status: "lobby",
  expiresAt: "2030-01-01T00:00:00.000Z",
  ...overrides,
});

const member = (userId: string, overrides: Partial<MemberRow> = {}): MemberRow => ({
  $id: `m-${userId}`,
  userId,
  slot: null,
  ready: false,
  ...overrides,
});

const failure = (check: Check<object>) => (check.ok ? undefined : check.error);

describe("isExpired", () => {
  test("is true at and after expiresAt", () => {
    const row = room({ expiresAt: "2030-01-01T00:00:00.000Z" });
    expect(isExpired(row, new Date("2029-12-31T23:59:59.999Z"))).toBe(false);
    expect(isExpired(row, new Date("2030-01-01T00:00:00.000Z"))).toBe(true);
  });
});

describe("checkClaimSlot", () => {
  const members = [member("owner"), member("ann", { slot: "red" }), member("bob")];

  test("lets a member claim a free slot", () => {
    expect(checkClaimSlot(room(), members, "bob", "blue")).toMatchObject({ ok: true });
  });
  test("refuses a slot another member holds", () => {
    expect(failure(checkClaimSlot(room(), members, "bob", "red"))).toBe("conflict");
  });
  test("lets the holder claim their own slot again", () => {
    expect(checkClaimSlot(room(), members, "ann", "red")).toMatchObject({ ok: true });
  });
  test("refuses slots the app does not define", () => {
    expect(failure(checkClaimSlot(room(), members, "bob", "pink"))).toBe("invalid_request");
  });
  test("refuses non-members and started rooms", () => {
    expect(failure(checkClaimSlot(room(), members, "eve", "blue"))).toBe("forbidden");
    expect(failure(checkClaimSlot(room({ status: "started" }), members, "bob", "blue"))).toBe(
      "conflict",
    );
  });
});

describe("release, unassign and ready", () => {
  const members = [member("owner"), member("ann", { slot: "red", ready: true })];

  test("members can release their own slot before the start", () => {
    expect(checkReleaseSlot(room(), members, "ann")).toMatchObject({ ok: true });
    expect(failure(checkReleaseSlot(room({ status: "started" }), members, "ann"))).toBe("conflict");
  });
  test("only the owner can unassign, and not after the start", () => {
    expect(checkUnassign(room(), members, "owner", "m-ann")).toMatchObject({ ok: true });
    expect(failure(checkUnassign(room(), members, "ann", "m-ann"))).toBe("forbidden");
    expect(failure(checkUnassign(room({ status: "started" }), members, "owner", "m-ann"))).toBe(
      "conflict",
    );
    expect(failure(checkUnassign(room(), members, "owner", "m-nobody"))).toBe("not_found");
  });
  test("a member needs a slot to ready up, but can always un-ready", () => {
    expect(failure(checkSetReady(room(), members, "owner", true))).toBe("conflict");
    expect(checkSetReady(room(), members, "owner", false)).toMatchObject({ ok: true });
    expect(checkSetReady(room(), members, "ann", true)).toMatchObject({ ok: true });
  });
});

describe("checkStart", () => {
  const ready = (userId: string, slot: string) => member(userId, { slot, ready: true });

  test("needs the owner, 2 armies and every army ready", () => {
    const members = [
      member("owner"),
      ready("ann", "red"),
      ready("bob", "blue"),
      member("spectator"),
    ];
    expect(checkStart(room(), members, "owner")).toEqual({ ok: true });
    expect(failure(checkStart(room(), members, "ann"))).toBe("forbidden");
  });
  test("refuses with fewer than 2 armies", () => {
    expect(failure(checkStart(room(), [member("owner"), ready("ann", "red")], "owner"))).toBe(
      "conflict",
    );
  });
  test("refuses while a player is not ready", () => {
    const members = [ready("ann", "red"), member("bob", { slot: "blue" })];
    expect(failure(checkStart(room(), members, "owner"))).toBe("conflict");
  });
  test("refuses a room that already started", () => {
    const members = [ready("ann", "red"), ready("bob", "blue")];
    expect(failure(checkStart(room({ status: "started" }), members, "owner"))).toBe("conflict");
  });
});

describe("checkDelete and checkUpdateData", () => {
  const members = [member("owner"), member("ann", { slot: "red" }), member("spectator")];

  test("only the owner deletes", () => {
    expect(checkDelete(room(), "owner")).toEqual({ ok: true });
    expect(failure(checkDelete(room(), "ann"))).toBe("forbidden");
  });
  test("only the owner writes room data", () => {
    expect(checkUpdateData(room(), members, "owner", "room")).toMatchObject({ ok: true });
    expect(failure(checkUpdateData(room(), members, "ann", "room"))).toBe("forbidden");
  });
  test("players write their own data, spectators cannot", () => {
    expect(checkUpdateData(room(), members, "ann", "member")).toMatchObject({ ok: true });
    expect(failure(checkUpdateData(room(), members, "spectator", "member"))).toBe("forbidden");
    expect(failure(checkUpdateData(room(), members, "eve", "member"))).toBe("forbidden");
  });
});
