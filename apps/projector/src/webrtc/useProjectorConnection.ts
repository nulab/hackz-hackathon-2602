import { useCallback, useEffect, useRef, useState } from "react";
import type { UpstreamMessage } from "@hackz/shared";
import { ProjectorConnection } from "./ProjectorConnection";
import type { ProjectorConnectionState } from "./ProjectorConnection";

export const useProjectorConnection = () => {
  const connectionRef = useRef<ProjectorConnection | null>(null);
  const [state, setState] = useState<ProjectorConnectionState>("disconnected");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messageHandler, setMessageHandler] = useState<((msg: UpstreamMessage) => void) | null>(
    null,
  );

  const open = useCallback(async () => {
    const conn = new ProjectorConnection();
    connectionRef.current = conn;
    conn.onStateChange(setState);

    const peerId = await conn.open();
    setRoomId(peerId);
  }, []);

  const disconnectAdmin = useCallback(() => {
    connectionRef.current?.disconnectAdmin();
  }, []);

  const close = useCallback(() => {
    connectionRef.current?.close();
    connectionRef.current = null;
    setRoomId(null);
  }, []);

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

  return { state, roomId, open, close, disconnectAdmin, onMessage };
};
