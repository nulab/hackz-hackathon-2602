import { useEffect, useRef } from "react";
import type { RoomMessage } from "@hackz/shared";
import { trpc } from "../lib/trpc";

export const useRoomPolling = (
  roomId: string | null,
  channel: string,
  intervalMs: number,
  onMessages: (messages: RoomMessage[]) => void,
) => {
  const cursorRef = useRef(0);
  const onMessagesRef = useRef(onMessages);
  onMessagesRef.current = onMessages;

  const { data } = trpc.room.poll.useQuery(
    { roomId: roomId!, channel },
    {
      enabled: !!roomId,
      refetchInterval: intervalMs,
    },
  );

  useEffect(() => {
    if (!data || data.messages.length === 0) {
      return;
    }
    const newMessages = data.messages.filter((m) => m.id > cursorRef.current);
    if (newMessages.length === 0) {
      return;
    }
    cursorRef.current = data.lastId;
    onMessagesRef.current(newMessages as RoomMessage[]);
  }, [data]);
};
