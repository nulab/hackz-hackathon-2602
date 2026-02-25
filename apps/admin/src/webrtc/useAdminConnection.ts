import { useCallback, useEffect, useRef, useState } from "react";
import type { DownstreamMessage } from "@hackz/shared";
import { AdminConnection } from "./AdminConnection";
import type { AdminConnectionState } from "./AdminConnection";
import { trpc } from "../lib/trpc";

export const useAdminConnection = () => {
  const connectionRef = useRef<AdminConnection | null>(null);
  const [state, setState] = useState<AdminConnectionState>("disconnected");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messageHandler, setMessageHandler] = useState<((msg: DownstreamMessage) => void) | null>(
    null,
  );

  const joinRoomMutation = trpc.signaling.joinRoom.useMutation();
  const sendSignalMutation = trpc.signaling.sendSignal.useMutation();

  // Admin 向けシグナリング SSE
  trpc.signaling.onSignalForAdmin.useSubscription(
    { roomId: roomId ?? "" },
    {
      enabled: !!roomId && state !== "connected",
      onData: async (event) => {
        const conn = connectionRef.current;
        if (!conn || !roomId) {
          return;
        }

        switch (event.type) {
          case "offer": {
            const answerPayload = await conn.handleOffer(event.payload);
            conn.onIceCandidate((candidate) => {
              sendSignalMutation.mutate({
                roomId,
                type: "ice-candidate",
                payload: candidate,
                from: "admin",
              });
            });
            sendSignalMutation.mutate({
              roomId,
              type: "answer",
              payload: answerPayload,
              from: "admin",
            });
            break;
          }
          case "ice-candidate":
            await conn.handleIceCandidate(event.payload);
            break;
          case "closed":
            conn.disconnect();
            setRoomId(null);
            break;
        }
      },
    },
  );

  const connect = useCallback(
    async (targetRoomId: string) => {
      const conn = new AdminConnection();
      connectionRef.current = conn;
      conn.setRoomId(targetRoomId);
      conn.onStateChange(setState);
      setRoomId(targetRoomId);

      await joinRoomMutation.mutateAsync({ roomId: targetRoomId });
      // SSE subscription が有効になり、offer を待つ
    },
    [joinRoomMutation],
  );

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    setRoomId(null);
  }, []);

  const sendNfcScan = useCallback((nfcId: string) => {
    connectionRef.current?.send({ type: "NFC_SCANNED", nfcId });
  }, []);

  const sendQrScan = useCallback((data: string) => {
    connectionRef.current?.send({ type: "QR_SCANNED", data });
  }, []);

  const onMessage = useCallback((handler: (msg: DownstreamMessage) => void) => {
    setMessageHandler(() => handler);
  }, []);

  // メッセージハンドラの登録
  useEffect(() => {
    if (!connectionRef.current || !messageHandler) {
      return;
    }
    return connectionRef.current.onMessage(messageHandler);
  }, [messageHandler, state]);

  // クリーンアップ
  useEffect(
    () => () => {
      connectionRef.current?.disconnect();
    },
    [],
  );

  return { state, roomId, connect, disconnect, sendNfcScan, sendQrScan, onMessage };
};
