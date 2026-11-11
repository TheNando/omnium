export type View = "room" | "combat" | "battle";

export const roomUrl = (code: string, view?: Exclude<View, "room">) =>
  `/?room=${code}${view ? `&view=${view}` : ""}`;
