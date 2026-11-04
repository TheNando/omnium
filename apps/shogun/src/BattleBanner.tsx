import { capitalize, currentBattle, findPlayer, roomUrl, type Game, type View } from "./game.ts";

/** Drops down from the top for as long as a battle is in progress. Click to join it. */
export function BattleBanner({
  code,
  game,
  meId,
  view,
}: {
  code: string;
  game: Game;
  meId: string;
  view: View;
}) {
  const battle = currentBattle(game.state);
  const attacker = battle && findPlayer(game, battle.attacker);
  const defender = battle && findPlayer(game, battle.defender);
  if (!battle || !attacker || !defender) return null;

  const text =
    battle.attacker === meId
      ? `You are attacking ${capitalize(defender.color)}`
      : battle.defender === meId
        ? `${capitalize(attacker.color)} is attacking you`
        : `${capitalize(attacker.color)} is attacking ${capitalize(defender.color)}`;

  const involved = battle.attacker === meId || battle.defender === meId;
  return view === "battle" ? (
    <div class={`battleBanner army-${attacker.color}`} role="status">
      {text}
    </div>
  ) : (
    <a
      class={`battleBanner army-${attacker.color} ${involved ? "involved" : ""}`}
      href={roomUrl(code, "battle")}
    >
      {text} · {involved ? "Join the battle" : "Watch"}
    </a>
  );
}
