import { useCallback, useEffect, useRef, useState } from "react";
import type { DownstreamMessage, UpstreamMessage } from "@hackz/shared";
import { ProjectorConnection } from "./ProjectorConnection";
import type { ProjectorConnectionState } from "./ProjectorConnection";
import { trpc } from "../lib/trpc";

export const useProjectorConnection = () => {
  const connectionRef = useRef<ProjectorConnection | null>(null);
  const [state, setState] = useState<ProjectorConnectionState>("disconnected");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messageHandler, setMessageHandler] = useState<((msg: UpstreamMessage) => void) | null>(
    null,
  );

  const createRoomMutation = trpc.signaling.createRoom.useMutation();
  const sendSignalMutation = trpc.signaling.sendSignal.useMutation();
  const closeRoomMutation = trpc.signaling.closeRoom.useMutation();

  // Projector 向けシグナリング SSE
  trpc.signaling.onSignalForProjector.useSubscription(
    { roomId: roomId ?? "" },
    {
      enabled: !!roomId && state !== "connected",
      onData: async (event) => {
        const conn = connectionRef.current;
        if (!conn || !roomId) {
          return;
        }

        switch (event.type) {
          case "joined": {
            const offerPayload = await conn.createOffer();
            conn.onIceCandidate((candidate) => {
              sendSignalMutation.mutate({
                roomId,
                type: "ice-candidate",
                payload: candidate,
                from: "projector",
              });
            });
            sendSignalMutation.mutate({
              roomId,
              type: "offer",
              payload: offerPayload,
              from: "projector",
            });
            break;
          }
          case "answer":
            await conn.handleAnswer(event.payload);
            break;
          case "ice-candidate":
            await conn.handleIceCandidate(event.payload);
            break;
        }
      },
    },
  );

  const open = useCallback(async () => {
    const conn = new ProjectorConnection();
    connectionRef.current = conn;
    conn.onStateChange(setState);

    const { roomId: newRoomId } = await createRoomMutation.mutateAsync();
    setRoomId(newRoomId);
    conn.onStateChange((s) => {
      setState(s);
    });
    setState("waiting");
  }, [createRoomMutation]);

  const disconnectAdmin = useCallback(() => {
    connectionRef.current?.disconnectAdmin();
  }, []);

  const close = useCallback(async () => {
    connectionRef.current?.close();
    connectionRef.current = null;
    if (roomId) {
      await closeRoomMutation.mutateAsync({ roomId });
      setRoomId(null);
    }
  }, [roomId, closeRoomMutation]);

  const onMessage = useCallback((handler: (msg: UpstreamMessage) => void) => {
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
      connectionRef.current?.close();
    },
    [],
  );

  const send = useCallback((msg: DownstreamMessage) => {
    connectionRef.current?.send(msg);
  }, []);

  return { state, roomId, open, close, disconnectAdmin, onMessage, send };
};
