import {
  ARMY_NAMES,
  ARMY_SHAPES,
  EMPTY,
  GRID_SIZE,
  LEVEL_TRACK,
  SPOT_HINTS,
  UNITS,
  levelOf,
  type Army,
  type ArmyShape,
  type ShogunColor,
  type UnitCode,
} from "@omnium/schemas";

type Props = {
  color: ShogunColor;
  shape: ArmyShape;
  army: Army;
  selected?: boolean;
  /** Makes the whole card a button, for choosing an army. */
  onSelect?: () => void;
};

const isUnit = (code: string): code is UnitCode => code in UNITS;

/** One army card: coloured strip with the name, level bar, and the 3 x 5 grid of units. */
export function ArmyCard({ color, shape, army, selected = false, onSelect }: Props) {
  const wins = Math.min(army.wins, LEVEL_TRACK.length - 1);
  const symbol = `--symbol:url(/images/symbols/${color}.webp);--x:${ARMY_SHAPES.indexOf(shape) * 50}%`;

  const card = (
    <div class={`armyCard army-${color} ${selected ? "selected" : ""}`} style={symbol}>
      <div class="armySwath">
        <span class="armySymbol" />
        <span class="armyName">{ARMY_NAMES[color][shape]}</span>
        <span class="armyLevel">Level {levelOf(army.wins)}</span>
      </div>
      <div class="levelBar">
        {LEVEL_TRACK.map((label, spot) => (
          <span key={spot} class={`levelSpot ${shape} ${spot === wins ? "current" : ""}`}>
            {label}
          </span>
        ))}
      </div>
      <div class="armyGrid">
        <span class="armyWatermark" />
        {Array.from({ length: GRID_SIZE }, (_, spot) => {
          const code = army.grid.charAt(spot) || EMPTY;
          if (!isUnit(code)) {
            return (
              <span key={spot} class="gridSpot empty">
                {SPOT_HINTS[spot]}
              </span>
            );
          }
          const unit = UNITS[code];
          return (
            <span key={spot} class="gridSpot unit" title={unit.name}>
              <span class="unitIcon" style={`--icon:url(/images/units/${unit.icon}.png)`} />
              <span class="unitValue">{unit.value}</span>
            </span>
          );
        })}
      </div>
    </div>
  );

  return onSelect ? (
    <button type="button" class="armyCardButton" aria-pressed={selected} onClick={onSelect}>
      {card}
    </button>
  ) : (
    card
  );
}
