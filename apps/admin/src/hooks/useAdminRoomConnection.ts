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

  const connect = useCallback(
    async (targetRoomId: string) => {
      setState("connecting");
      try {
        await joinMutation.mutateAsync({ roomId: targetRoomId });
        roomIdRef.current = targetRoomId;
        setRoomId(targetRoomId);
        setState("connected");
      } catch {
        setState("disconnected");
      }
    },
    [joinMutation],
  );

  const disconnect = useCallback(() => {
    if (roomIdRef.current) {
      disconnectMutation.mutate({ roomId: roomIdRef.current, role: "admin" });
    }
    roomIdRef.current = null;
    setRoomId(null);
    setState("disconnected");
  }, [disconnectMutation]);

  const sendNfcScan = useCallback(
    (nfcId: string) => {
      if (!roomIdRef.current) {
        return;
      }
      sendMutation.mutate({
        roomId: roomIdRef.current,
        channel: "upstream",
        message: { type: "NFC_SCANNED", payload: { nfcId } },
      });
    },
    [sendMutation],
  );

  const sendQrScan = useCallback(
    (data: string) => {
      if (!roomIdRef.current) {
        return;
      }
      sendMutation.mutate({
        roomId: roomIdRef.current,
        channel: "upstream",
        message: { type: "QR_SCANNED", payload: { data } },
      });
    },
    [sendMutation],
  );

  // Heartbeat every 5 seconds
  useEffect(() => {
    if (!roomIdRef.current) {
      return;
    }
    const currentRoomId = roomIdRef.current;

    const interval = setInterval(async () => {
      try {
        await heartbeatMutation.mutateAsync({ roomId: currentRoomId, role: "admin" });
      } catch {
        setState("disconnected");
        roomIdRef.current = null;
        setRoomId(null);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId, heartbeatMutation]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (roomIdRef.current) {
        disconnectMutation.mutate({ roomId: roomIdRef.current, role: "admin" });
      }
    },
    [disconnectMutation],
  );

  return { state, roomId, connect, disconnect, sendNfcScan, sendQrScan };
};
