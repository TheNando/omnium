import { LocationProvider, Route, Router, useRoute } from "preact-iso";
import { roomCodeSchema } from "@omnium/schemas";
import { Menu } from "@/features/menu";
import { Room } from "@/features/room";
import { RoomMessage } from "@/features/room/RoomMessage.tsx";
import { parseView } from "@/game";

const NotFound = () => <RoomMessage>Page not found.</RoomMessage>;

function RoomRoute() {
  const { params } = useRoute();
  const code = roomCodeSchema.safeParse(params.code ?? "");
  const view = parseView(params.view);
  if (!code.success || !view) return <NotFound />;
  return <Room code={code.data} view={view} />;
}

export function App() {
  return (
    <LocationProvider>
      <main class="titlePage backgroundTint">
        <img class="logo" src="/images/logo.png" alt="Shōgun" />
        <Router>
          <Route path="/" component={Menu} />
          <Route path="/room/:code/:view?" component={RoomRoute} />
          <Route default component={NotFound} />
        </Router>
      </main>
    </LocationProvider>
  );
}
