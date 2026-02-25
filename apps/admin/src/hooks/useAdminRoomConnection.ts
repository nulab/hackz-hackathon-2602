import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "../lib/trpc";

export type AdminConnectionState = "disconnected" | "connecting" | "connected";

export const useAdminRoomConnection = () => {
  const [state, setState] = useState<AdminConnectionState>("disconnected");
  const [roomId, setRoomId] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  const joinMutation = trpc.room.join.useMutation();
  const sendMutation = trpc.room.send.useMutation();
  const heartbeatMutation = trpc.room.heartbeat.useMutation();
  const disconnectMutation = trpc.room.disconnect.useMutation();

  // Refs for mutation methods to avoid re-render loops in dependency arrays
  const joinRef = useRef(joinMutation.mutateAsync);
  const sendRef = useRef(sendMutation.mutate);
  const heartbeatRef = useRef(heartbeatMutation.mutateAsync);
  const disconnectRef = useRef(disconnectMutation.mutate);
  joinRef.current = joinMutation.mutateAsync;
  sendRef.current = sendMutation.mutate;
  heartbeatRef.current = heartbeatMutation.mutateAsync;
  disconnectRef.current = disconnectMutation.mutate;

  const connect = useCallback(async (targetRoomId: string) => {
    setState("connecting");
    try {
      await joinRef.current({ roomId: targetRoomId });
      roomIdRef.current = targetRoomId;
      setRoomId(targetRoomId);
      setState("connected");
    } catch {
      setState("disconnected");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (roomIdRef.current) {
      disconnectRef.current({ roomId: roomIdRef.current, role: "admin" });
    }
    roomIdRef.current = null;
    setRoomId(null);
    setState("disconnected");
  }, []);

  const sendNfcScan = useCallback((nfcId: string) => {
    if (!roomIdRef.current) {
      return;
    }
    sendRef.current({
      roomId: roomIdRef.current,
      channel: "upstream",
      message: { type: "NFC_SCANNED", payload: { nfcId } },
    });
  }, []);

  const sendQrScan = useCallback((data: string) => {
    if (!roomIdRef.current) {
      return;
    }
    sendRef.current({
      roomId: roomIdRef.current,
      channel: "upstream",
      message: { type: "QR_SCANNED", payload: { data } },
    });
  }, []);

  // Heartbeat every 5 seconds
  useEffect(() => {
    if (!roomIdRef.current) {
      return;
    }
    const currentRoomId = roomIdRef.current;

    const interval = setInterval(async () => {
      try {
        await heartbeatRef.current({ roomId: currentRoomId, role: "admin" });
      } catch {
        setState("disconnected");
        roomIdRef.current = null;
        setRoomId(null);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (roomIdRef.current) {
        disconnectRef.current({ roomId: roomIdRef.current, role: "admin" });
      }
    },
    [],
  );

  return { state, roomId, connect, disconnect, sendNfcScan, sendQrScan };
};
