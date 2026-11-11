import { ArmyCard } from "@/features/armies";
import type { RoomViewProps } from "@/features/room";
import { currentBattle, findPlayer, readGame, roomUrl } from "@/game";
import "./battle.css";

/** Placeholder battle page: shows both armies. Battle resolution comes later. */
export function BattlePage({ room, members, me, pending, error, run }: RoomViewProps) {
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
