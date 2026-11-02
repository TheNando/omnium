import { Menu } from "./Menu.tsx";

export function App() {
  const armies = new URLSearchParams(location.search).get("q");

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
      <Menu />
    </main>
  );
}
