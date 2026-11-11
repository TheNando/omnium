import { useEffect, useRef } from "preact/hooks";
import {
  useCurrentUser,
  useRoom,
  useRoomAction,
  useRoomMembers,
  useRoomSubscription,
} from "@omnium/query";
import type { Room as RoomData, RoomAction } from "@omnium/schemas";
import { BattleBanner, BattlePage } from "@/features/battle";
import { CombatPage } from "@/features/combat";
import { readGame, type View } from "@/game";
import { JoinForm } from "./JoinForm.tsx";
import { RoomLobby } from "./RoomLobby.tsx";
import { RoomMessage } from "./RoomMessage.tsx";
import "./room.css";

/** Loads a room, joins it if needed, and shows it live. */
export function Room({ code, view }: { code: string; view: View }) {
  const user = useCurrentUser();
  const room = useRoom(code);
  const members = useRoomMembers(code);
  useRoomSubscription(code);
  const join = useRoomAction();
  const action = useRoomAction();
  const lastRoom = useRef<RoomData | null>(null);
  const autoJoined = useRef(false);

  if (room.data) lastRoom.current = room.data;
  const me = members.data?.find((member) => member.userId === user.data?.id);
  const savedName = user.data?.name ?? "";
  const needsJoin = room.data && members.data && user.data && !me;

  // A returning player (or a shared link opened with a saved name) joins straight away.
  useEffect(() => {
    if (needsJoin && savedName && !autoJoined.current) {
      autoJoined.current = true;
      join.mutate({ action: "join", app: "shogun", code, name: savedName });
    }
  }, [needsJoin, savedName, code, join]);

  if (user.isError || room.isError || members.isError) {
    return <RoomMessage>Cannot reach the server. Try reloading.</RoomMessage>;
  }
  if (room.data === null) {
    if (!lastRoom.current) return <RoomMessage>Room not found.</RoomMessage>;
    const expired = new Date(lastRoom.current.expiresAt).getTime() <= Date.now();
    return <RoomMessage>{expired ? "Room expired." : "Room closed by the owner."}</RoomMessage>;
  }
  if (!room.data || !members.data || !user.data) return <p class="panel label">Loading…</p>;

  if (!me) {
    if (savedName && !join.isError) return <p class="panel label">Joining…</p>;
    return <JoinForm code={code} join={join} />;
  }

  const page = {
    room: room.data,
    members: members.data,
    me,
    pending: action.isPending,
    error: action.error?.message,
    run: (next: RoomAction) => action.mutate(next),
  };
  const game = readGame(room.data, members.data);
  const started = room.data.status === "started";

  return (
    <>
      {started && <BattleBanner code={code} game={game} meId={me.userId} view={view} />}
      {started && view === "combat" ? (
        <CombatPage {...page} />
      ) : started && view === "battle" ? (
        <BattlePage {...page} />
      ) : (
        <RoomLobby {...page} />
      )}
    </>
  );
}
