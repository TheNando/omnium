import { findPlayer, type Game } from "./game.ts";

/** Round number, phase, this round's player order and who has clicked Done. */
export function RoundStatus({ game, meId }: { game: Game; meId: string }) {
  const { state } = game;
  if (!state) return null;
  return (
    <div class="roundStatus">
      <p class="label">
        Round {state.round} · {state.phase === "orders" ? "Orders" : "Battles"}
      </p>
      <ol class="orderList">
        {state.order.map((userId) => {
          const player = findPlayer(game, userId);
          if (!player) return null;
          const done = state.done.includes(userId);
          return (
            <li key={userId} class="orderRow">
              <img
                class="memberBanner"
                src={`/images/${player.color}-banner.png`}
                alt={`${player.color} army`}
              />
              <span class="memberName">
                {player.member.name}
                {userId === meId && " (you)"}
              </span>
              {state.phase === "orders" && (
                <span class="readyTag">{done ? "Done" : "Planning"}</span>
              )}
            </li>
          );
        })}
      </ol>
      <p class="hint">Turn order is drawn again every round.</p>
    </div>
  );
}
