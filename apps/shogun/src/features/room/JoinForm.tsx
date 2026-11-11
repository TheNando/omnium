import { useState } from "preact/hooks";
import { playerNameSchema, type RoomAction } from "@omnium/schemas";

type Join = {
  isPending: boolean;
  error: Error | null;
  mutate: (action: RoomAction) => void;
};

/** Asks a player without a saved name for one, then joins the room. */
export function JoinForm({ code, join }: { code: string; join: Join }) {
  const [typedName, setTypedName] = useState("");
  const name = playerNameSchema.safeParse(typedName);
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
