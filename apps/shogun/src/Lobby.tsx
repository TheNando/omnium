import { useEffect, useRef, useState } from "preact/hooks";
import {
  useCurrentUser,
  useRoom,
  useRoomAction,
  useRoomMembers,
  useRoomSubscription,
} from "@omnium/query";
import { playerNameSchema, type Room } from "@omnium/schemas";
import { RoomView } from "./RoomView.tsx";

const Message = ({ children }: { children: string }) => (
  <div class="panel">
    <p class="label">{children}</p>
    <a class="startButton linkButton" href="/">
      Back to menu
    </a>
  </div>
);

/** Loads a room, joins it if needed, and shows it live. */
export function Lobby({ code }: { code: string }) {
  const user = useCurrentUser();
  const room = useRoom(code);
  const members = useRoomMembers(code);
  useRoomSubscription(code);
  const join = useRoomAction();
  const action = useRoomAction();
  const [typedName, setTypedName] = useState("");
  const lastRoom = useRef<Room | null>(null);
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
    return <Message>Cannot reach the server. Try reloading.</Message>;
  }
  if (room.data === null) {
    if (!lastRoom.current) return <Message>Room not found.</Message>;
    const expired = new Date(lastRoom.current.expiresAt).getTime() <= Date.now();
    return <Message>{expired ? "Room expired." : "Room closed by the owner."}</Message>;
  }
  if (!room.data || !members.data || !user.data) return <p class="panel label">Loading…</p>;

  if (!me) {
    const name = playerNameSchema.safeParse(typedName);
    if (savedName && !join.isError) return <p class="panel label">Joining…</p>;
    return (
      <form
        class="panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.success) join.mutate({ action: "join", app: "shogun", code, name: name.data });
        }}
      >
        <label class="label" for="playerName">
          Enter your player name to join room {code}
        </label>
        <input
          id="playerName"
          class="textInput"
          value={typedName}
          maxLength={20}
          autoFocus
          autoComplete="off"
          onInput={(event) => setTypedName(event.currentTarget.value)}
        />
        <button class="startButton" type="submit" disabled={!name.success || join.isPending}>
          Join
        </button>
        {join.error && <p class="error">{join.error.message}</p>}
      </form>
    );
  }

  return (
    <RoomView
      room={room.data}
      members={members.data}
      me={me}
      pending={action.isPending}
      error={action.error?.message}
      run={(next) => action.mutate(next)}
    />
  );
}
