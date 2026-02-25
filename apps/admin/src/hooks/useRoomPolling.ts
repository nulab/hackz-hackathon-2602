import { useEffect, useRef } from "react";
import { trpc } from "../lib/trpc";

type Message = {
  id: number;
  type: string;
  payload: unknown;
  createdAt: number;
};

export const useRoomPolling = (
  roomId: string | null,
  channel: string,
  intervalMs: number,
  onMessages: (messages: Message[]) => void,
) => {
  const cursorRef = useRef(0);
  const onMessagesRef = useRef(onMessages);
  onMessagesRef.current = onMessages;

  const { data } = trpc.room.poll.useQuery(
    { roomId: roomId!, channel, afterId: cursorRef.current },
    {
      enabled: !!roomId,
      refetchInterval: intervalMs,
    },
  );

  useEffect(() => {
    if (!data || data.messages.length === 0) {
      return;
    }
    cursorRef.current = data.lastId;
    onMessagesRef.current(data.messages);
  }, [data]);
};
