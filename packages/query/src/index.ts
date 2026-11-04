import { useEffect } from "preact/hooks";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/preact-query";
import {
  ensureSession,
  getRoom,
  listMembers,
  runRoomAction,
  subscribeToRoom,
  updateName,
} from "@omnium/appwrite";
import type { RoomAction } from "@omnium/schemas";

export { QueryClient, QueryClientProvider } from "@tanstack/preact-query";

export const queryKeys = {
  user: ["user"] as const,
  room: (code: string) => ["room", code] as const,
  members: (code: string) => ["room", code, "members"] as const,
};

export const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } } });

/** Thrown when the `rooms` Function refuses an action. `kind` is its error code. */
export class RoomActionError extends Error {
  kind: string;
  constructor(message: string, kind: string) {
    super(message);
    this.kind = kind;
  }
}

export const useCurrentUser = () =>
  useQuery({ queryKey: queryKeys.user, queryFn: ensureSession, staleTime: Infinity });

export const useRoom = (code: string) =>
  useQuery({ queryKey: queryKeys.room(code), queryFn: () => getRoom(code) });

export const useRoomMembers = (code: string) =>
  useQuery({ queryKey: queryKeys.members(code), queryFn: () => listMembers(code) });

/** Keeps `useRoom` and `useRoomMembers` live: refetches them when Realtime reports a change. */
export function useRoomSubscription(code: string) {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      subscribeToRoom(code, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.room(code) });
      }),
    [code, queryClient],
  );
}

/** Runs any room action (join, claimSlot, setReady, ...). Throws a `RoomActionError` if refused. */
export function useRoomAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: RoomAction) => {
      const result = await runRoomAction(action);
      if (!result.ok) throw new RoomActionError(result.message, result.error);
      if ("name" in action) void updateName(action.name).catch(() => {});
      return result.code;
    },
    onSettled: (_code, _error, action) => {
      if ("code" in action) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.room(action.code) });
      }
    },
  });
}
