import { roomCodeSchema } from "@omnium/schemas";
import { Lobby } from "./Lobby.tsx";
import { Menu } from "./Menu.tsx";

export function App() {
  const params = new URLSearchParams(location.search);
  const armies = params.get("q");
  const room = roomCodeSchema.safeParse(params.get("room") ?? "");

  if (armies) {
    return (
      <main class="titlePage backgroundTint">
        <div class="flex alignCenter">
          <hr class="flexRule" />
          <h3 class="textShadow">COMBAT CALCULATOR</h3>
          <hr class="flexRule" />
        </div>
      </main>
    );
  }

  return (
    <main class="titlePage backgroundTint">
      <img class="logo" src="/images/logo.png" alt="Shōgun" />
      {room.success ? <Lobby code={room.data} /> : <Menu />}
    </main>
  );
}
