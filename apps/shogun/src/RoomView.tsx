import { APP_RULES, type Member, type Room, type RoomAction } from "@omnium/schemas";

const { slots, minSlotsToStart } = APP_RULES.shogun;

type Props = {
  room: Room;
  members: Member[];
  me: Member;
  pending: boolean;
  error?: string;
  run: (action: RoomAction) => void;
};

/** The lobby for a room the current user has joined. */
export function RoomView({ room, members, me, pending, error, run }: Props) {
  const code = room.$id;
  const isOwner = room.ownerId === me.userId;
  const inLobby = room.status === "lobby";
  const players = members.filter((member) => member.slot !== null);
  const canStart =
    isOwner &&
    inLobby &&
    players.length >= minSlotsToStart &&
    players.every((player) => player.ready);

  return (
    <div class="panel">
      <p class="label">Room code</p>
      <p class="roomCode">{code}</p>

      {inLobby ? (
        <>
          <p class="label">Pick your army</p>
          <div class="bannerRow">
            {slots.map((slot) => {
              const holder = members.find((member) => member.slot === slot);
              const mine = holder?.userId === me.userId;
              return (
                <button
                  key={slot}
                  type="button"
                  class={`bannerButton ${mine ? "selected" : ""}`}
                  disabled={pending || (holder !== undefined && !mine)}
                  aria-pressed={mine}
                  onClick={() =>
                    run(
                      mine ? { action: "releaseSlot", code } : { action: "claimSlot", code, slot },
                    )
                  }
                >
                  <img src={`/images/${slot}-banner.png`} alt={`${slot} army`} />
                </button>
              );
            })}
          </div>
          {me.slot && (
            <button
              class="startButton"
              type="button"
              disabled={pending}
              onClick={() => run({ action: "setReady", code, ready: !me.ready })}
            >
              {me.ready ? "Not ready" : "Ready"}
            </button>
          )}
        </>
      ) : (
        <p class="label">The game has started.</p>
      )}

      <p class="label">Players ({members.length})</p>
      <ul class="memberList">
        {members.map((member) => (
          <li key={member.$id} class="memberRow">
            {member.slot ? (
              <img
                class="memberBanner"
                src={`/images/${member.slot}-banner.png`}
                alt={`${member.slot} army`}
              />
            ) : (
              <span class="memberBanner spectator">Spectator</span>
            )}
            <span class="memberName">
              {member.name}
              {member.userId === room.ownerId && " (owner)"}
              {member.userId === me.userId && " (you)"}
            </span>
            {member.slot && <span class="readyTag">{member.ready ? "Ready" : "Not ready"}</span>}
            {isOwner && inLobby && member.slot && (
              <button
                class="smallButton"
                type="button"
                disabled={pending}
                onClick={() => run({ action: "unassign", code, memberId: member.$id })}
              >
                Unassign
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div class="buttonRow">
          {inLobby && (
            <button
              class="startButton"
              type="button"
              disabled={!canStart || pending}
              onClick={() => run({ action: "start", code })}
            >
              Start game
            </button>
          )}
          <button
            class="smallButton"
            type="button"
            disabled={pending}
            onClick={() =>
              confirm("Delete this room for everyone?") && run({ action: "delete", code })
            }
          >
            Delete room
          </button>
        </div>
      )}
      {error && <p class="error">{error}</p>}
    </div>
  );
}
