import type { Member, Room, RoomAction } from "@omnium/schemas";

/** Props shared by every page that shows a joined room. */
export type RoomViewProps = {
  room: Room;
  members: Member[];
  me: Member;
  pending: boolean;
  error?: string;
  run: (action: RoomAction) => void;
};
