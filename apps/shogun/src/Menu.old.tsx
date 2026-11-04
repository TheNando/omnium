import { useState } from "preact/hooks";

const ARMIES = ["red", "orange", "green", "blue", "purple"] as const;

type Army = (typeof ARMIES)[number];

export function Menu() {
  const [selected, setSelected] = useState<Army[]>([]);

  const toggle = (army: Army) =>
    setSelected((current) =>
      current.includes(army) ? current.filter((item) => item !== army) : [...current, army],
    );

  const start = () => {
    const query = selected.map((army) => army[0]).join("");
    location.assign(`?q=${query}`);
  };

  return (
    <>
      {ARMIES.map((army) => (
        <button
          key={army}
          type="button"
          class={`bannerButton ${selected.includes(army) ? "selected" : ""}`}
          aria-pressed={selected.includes(army)}
          onClick={() => toggle(army)}
        >
          <img src={`/images/${army}-banner.png`} alt={`${army} army`} />
        </button>
      ))}
      {selected.length > 0 && (
        <button class="startButton" type="button" onClick={start}>
          START
        </button>
      )}
    </>
  );
}
