import { useState } from "preact/hooks";
import {
  ARMY_NAMES,
  ARMY_SHAPES,
  type ArmyShape,
  type Member,
  type Room,
  type RoomAction,
} from "@omnium/schemas";
import { ArmyCard } from "./ArmyCard.tsx";
import { RoundStatus } from "./RoundStatus.tsx";
import { capitalize, findPlayer, lockFor, readGame, roomUrl } from "./game.ts";

type Props = {
  room: Room;
  members: Member[];
  me: Member;
  pending: boolean;
  error?: string;
  run: (action: RoomAction) => void;
};

/** Orders: pick one of your armies, an opponent and one of their armies, then lock the battle. */
export function CombatPage({ room, members, me, pending, error, run }: Props) {
  const code = room.$id;
  const game = readGame(room, members);
  const { state } = game;
  const self = findPlayer(game, me.userId);
  const opponents = game.players.filter((player) => player.member.userId !== me.userId);

  const [from, setFrom] = useState<ArmyShape>();
  const [defenderId, setDefenderId] = useState<string>();
  const [target, setTarget] = useState<ArmyShape>();
  const defender = opponents.find((player) => player.member.userId === defenderId);

  const back = (
    <a class="smallButton linkButton" href={roomUrl(code)}>
      Back to room
    </a>
  );
  if (!state || !self?.armies) {
    return (
      <div class="panel">
        {back}
        <p class="label">Only players in a game with saved armies can open combat.</p>
      </div>
    );
  }

  const myArmies = self.armies;
  const theirArmies = defender?.armies;
  const planning = state.phase === "orders" && !state.done.includes(me.userId);
  const ready = planning && from && defender?.armies && target;

  const lockSelected = () => {
    if (!from || !defender || !target) return;
    run({ action: "lockBattle", code, from, defender: defender.member.userId, target });
    setFrom(undefined);
    setDefenderId(undefined);
    setTarget(undefined);
  };

  return (
    <div class="panel wide">
      {back}
      <RoundStatus game={game} meId={me.userId} />

      <p class="label">Your armies</p>
      <div class="cardRow">
        {ARMY_SHAPES.map((shape) => {
          const lock = lockFor(state, me.userId, shape);
          const against = lock && findPlayer(game, lock.defender);
          return (
            <div key={shape} class="cardColumn">
              <ArmyCard
                color={self.color}
                shape={shape}
                army={myArmies[shape]}
                selected={from === shape}
                onSelect={planning ? () => setFrom(shape) : undefined}
              />
              {lock && against && (
                <p class="lockNote">
                  Locked: attacks {capitalize(against.color)}'s{" "}
                  {ARMY_NAMES[against.color][lock.target]}
                  {planning && (
                    <button
                      class="smallButton"
                      type="button"
                      disabled={pending}
                      onClick={() => run({ action: "cancelBattle", code, from: shape })}
                    >
                      Cancel
                    </button>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p class="label">Choose who to attack</p>
      <div class="opponentRow">
        {opponents.map(({ member, color }) => (
          <button
            key={member.$id}
            type="button"
            class={`bannerButton ${defenderId === member.userId ? "selected" : ""}`}
            aria-pressed={defenderId === member.userId}
            disabled={!planning || !from}
            title={member.name}
            onClick={() => {
              setDefenderId(member.userId);
              setTarget(undefined);
            }}
          >
            <img src={`/images/${color}-banner.png`} alt={`${color} army`} />
          </button>
        ))}
      </div>

      {defender && theirArmies && (
        <div class="cardRow">
          {ARMY_SHAPES.map((shape) => (
            <ArmyCard
              key={shape}
              color={defender.color}
              shape={shape}
              army={theirArmies[shape]}
              selected={target === shape}
              onSelect={() => setTarget(shape)}
            />
          ))}
        </div>
      )}

      <div class="buttonRow">
        <button
          class="startButton"
          type="button"
          disabled={!ready || pending}
          onClick={lockSelected}
        >
          Start Battle
        </button>
        <button
          class="startButton"
          type="button"
          disabled={!planning || pending}
          onClick={() => run({ action: "finishOrders", code })}
        >
          Done
        </button>
      </div>
      <p class="hint">
        {state.phase === "battles"
          ? "Battles are in progress. New orders open next round."
          : planning
            ? "Start Battle locks your choice. Battles begin once everyone clicks Done."
            : "Waiting for the other players to click Done."}
      </p>
      {error && <p class="error">{error}</p>}
    </div>
  );
}
