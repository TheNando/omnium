export type View = "room" | "combat" | "battle";

export const roomUrl = (code: string, view?: Exclude<View, "room">) =>
  `/room/${code}${view ? `/${view}` : ""}`;

/** Maps an optional URL segment to a view; unknown segments return `undefined`. */
export const parseView = (value: string | undefined): View | undefined =>
  value === undefined ? "room" : value === "combat" || value === "battle" ? value : undefined;
