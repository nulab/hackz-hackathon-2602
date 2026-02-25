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

  // Refs for mutation methods to avoid re-render loops in dependency arrays
  const createRef = useRef(createMutation.mutateAsync);
  const heartbeatRef = useRef(heartbeatMutation.mutateAsync);
  const disconnectRef = useRef(disconnectMutation.mutate);
  createRef.current = createMutation.mutateAsync;
  heartbeatRef.current = heartbeatMutation.mutateAsync;
  disconnectRef.current = disconnectMutation.mutate;

  const open = useCallback(async () => {
    const result = await createRef.current();
    roomIdRef.current = result.roomId;
    setRoomId(result.roomId);
    setState("waiting");
  }, []);

  const close = useCallback(() => {
    if (roomIdRef.current) {
      disconnectRef.current({ roomId: roomIdRef.current, role: "projector" });
    }
    roomIdRef.current = null;
    setRoomId(null);
    setState("disconnected");
  }, []);

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
        const result = await heartbeatRef.current({
          roomId: currentRoomId,
          role: "projector",
        });
        setState(result.peerConnected ? "connected" : "waiting");
      } catch {
        // Room may have been deleted
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (roomIdRef.current) {
        disconnectRef.current({ roomId: roomIdRef.current, role: "projector" });
      }
    },
    [],
  );

  return { state, roomId, open, close, disconnectAdmin };
};
