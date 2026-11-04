import type { Member, Room, RoomAction } from "@omnium/schemas";
import { ArmyCard } from "./ArmyCard.tsx";
import { currentBattle, findPlayer, readGame, roomUrl } from "./game.ts";

type Props = {
  room: Room;
  members: Member[];
  me: Member;
  pending: boolean;
  error?: string;
  run: (action: RoomAction) => void;
};

/** Placeholder battle page: shows both armies. Battle resolution comes later. */
export function BattlePage({ room, members, me, pending, error, run }: Props) {
  const code = room.$id;
  const game = readGame(room, members);
  const battle = currentBattle(game.state);
  const attacker = battle && findPlayer(game, battle.attacker);
  const defender = battle && findPlayer(game, battle.defender);
  const attackingArmy = battle && attacker?.armies?.[battle.from];
  const defendingArmy = battle && defender?.armies?.[battle.target];
  const involved = battle?.attacker === me.userId || battle?.defender === me.userId;

  return (
    <div class="panel wide">
      <a class="smallButton linkButton" href={roomUrl(code)}>
        Back to room
      </a>
      {battle && attacker && defender && attackingArmy && defendingArmy ? (
        <>
          <p class="label">
            {attacker.member.name} attacks {defender.member.name}
          </p>
          <div class="cardRow">
            <ArmyCard color={attacker.color} shape={battle.from} army={attackingArmy} />
            <ArmyCard color={defender.color} shape={battle.target} army={defendingArmy} />
          </div>
          {involved ? (
            <button
              class="startButton"
              type="button"
              disabled={pending}
              onClick={() => run({ action: "endBattle", code })}
            >
              End battle
            </button>
          ) : (
            <p class="hint">You are watching this battle.</p>
          )}
        </>
      ) : (
        <p class="label">No battle in progress.</p>
      )}
      {error && <p class="error">{error}</p>}
    </div>
  );
}
