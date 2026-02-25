import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "../lib/trpc";

export type RoomConnectionState = "disconnected" | "waiting" | "connected";

export const useRoomConnection = () => {
  const [state, setState] = useState<RoomConnectionState>("disconnected");
  const [roomId, setRoomId] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  const createMutation = trpc.room.create.useMutation();
  const heartbeatMutation = trpc.room.heartbeat.useMutation();
  const disconnectMutation = trpc.room.disconnect.useMutation();

  const open = useCallback(async () => {
    const result = await createMutation.mutateAsync();
    roomIdRef.current = result.roomId;
    setRoomId(result.roomId);
    setState("waiting");
  }, [createMutation]);

  const close = useCallback(() => {
    if (roomIdRef.current) {
      disconnectMutation.mutate({ roomId: roomIdRef.current, role: "projector" });
    }
    roomIdRef.current = null;
    setRoomId(null);
    setState("disconnected");
  }, [disconnectMutation]);

  const disconnectAdmin = useCallback(() => {
    // Admin's heartbeat will timeout, nothing to do server-side
    setState("waiting");
  }, []);

  // Heartbeat every 5 seconds
  useEffect(() => {
    if (!roomIdRef.current) {
      return;
    }
    const currentRoomId = roomIdRef.current;

    const interval = setInterval(async () => {
      try {
        const result = await heartbeatMutation.mutateAsync({
          roomId: currentRoomId,
          role: "projector",
        });
        setState(result.peerConnected ? "connected" : "waiting");
      } catch {
        // Room may have been deleted
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId, heartbeatMutation]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (roomIdRef.current) {
        disconnectMutation.mutate({ roomId: roomIdRef.current, role: "projector" });
      }
    },
    [disconnectMutation],
  );

  return { state, roomId, open, close, disconnectAdmin };
};
