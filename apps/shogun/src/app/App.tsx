import { roomCodeSchema } from "@omnium/schemas";
import { Menu } from "@/features/menu";
import { Room } from "@/features/room";
import type { View } from "@/game";

export function App() {
  const params = new URLSearchParams(location.search);
  const room = roomCodeSchema.safeParse(params.get("room") ?? "");
  const requested = params.get("view");
  const view: View = requested === "combat" || requested === "battle" ? requested : "room";

  return (
    <main class="titlePage backgroundTint">
      <img class="logo" src="/images/logo.png" alt="Shōgun" />
      {room.success ? <Room code={room.data} view={view} /> : <Menu />}
    </main>
  );
}
