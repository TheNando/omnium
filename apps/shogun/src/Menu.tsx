import { useState } from "preact/hooks";
import { useCurrentUser, useRoomAction } from "@omnium/query";
import { playerNameSchema, roomCodeSchema } from "@omnium/schemas";

const goToRoom = (code: string) => location.assign(`?room=${code}`);

export function Menu() {
  const user = useCurrentUser();
  const action = useRoomAction();
  const [typedName, setTypedName] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [typedCode, setTypedCode] = useState("");

  // Until the player types, show the name saved on their account.
  const name = playerNameSchema.safeParse(typedName ?? user.data?.name ?? "");
  const code = roomCodeSchema.safeParse(typedCode);

  const create = () => {
    if (name.success) {
      action.mutate({ action: "create", app: "shogun", name: name.data }, { onSuccess: goToRoom });
    }
  };
  const join = (event: Event) => {
    event.preventDefault();
    if (name.success && code.success) {
      action.mutate(
        { action: "join", app: "shogun", name: name.data, code: code.data },
        { onSuccess: goToRoom },
      );
    }
  };

  if (user.isError) return <p class="panel error">Cannot reach the server. Try reloading.</p>;

  return (
    <div class="panel">
      <label class="label" for="playerName">
        Enter your player name
      </label>
      <input
        id="playerName"
        class="textInput"
        value={typedName ?? user.data?.name ?? ""}
        maxLength={20}
        autoComplete="off"
        onInput={(event) => setTypedName(event.currentTarget.value)}
      />
      <div class="buttonRow">
        <button
          class="startButton"
          type="button"
          disabled={!name.success}
          onClick={() => setJoining(true)}
        >
          Join a room
        </button>
        <button
          class="startButton"
          type="button"
          disabled={!name.success || action.isPending}
          onClick={create}
        >
          Create a room
        </button>
      </div>
      {joining && (
        <form class="buttonRow" onSubmit={join}>
          <input
            class="textInput codeInput"
            value={typedCode}
            placeholder="CODE"
            maxLength={4}
            autoFocus
            autoComplete="off"
            aria-label="Room code"
            onInput={(event) => setTypedCode(event.currentTarget.value.toUpperCase())}
          />
          <button
            class="startButton"
            type="submit"
            disabled={!name.success || !code.success || action.isPending}
          >
            Go
          </button>
        </form>
      )}
      {action.error && <p class="error">{action.error.message}</p>}
    </div>
  );
}
