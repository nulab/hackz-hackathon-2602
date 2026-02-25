import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPeerServerConfig } from "@hackz/shared";
import type { UpstreamMessage } from "@hackz/shared";
import { ProjectorConnection } from "./ProjectorConnection";
import type { ProjectorConnectionState } from "./ProjectorConnection";

const API_URL = import.meta.env.VITE_API_URL || "/trpc";

export const useProjectorConnection = () => {
  const connectionRef = useRef<ProjectorConnection | null>(null);
  const messageHandlerRef = useRef<((msg: UpstreamMessage) => void) | null>(null);
  const [state, setState] = useState<ProjectorConnectionState>("disconnected");
  const [roomId, setRoomId] = useState<string | null>(null);

  const peerConfig = useMemo(() => getPeerServerConfig(API_URL), []);

  const open = useCallback(async () => {
    const conn = new ProjectorConnection();
    connectionRef.current = conn;
    conn.onStateChange(setState);

    if (messageHandlerRef.current) {
      conn.onMessage(messageHandlerRef.current);
    }

    const peerId = await conn.open(peerConfig);
    setRoomId(peerId);
  }, [peerConfig]);

  const disconnectAdmin = useCallback(() => {
    connectionRef.current?.disconnectAdmin();
  }, []);

  const close = useCallback(() => {
    connectionRef.current?.close();
    connectionRef.current = null;
    setRoomId(null);
  }, []);

  const onMessage = useCallback((handler: (msg: UpstreamMessage) => void) => {
    messageHandlerRef.current = handler;
    if (connectionRef.current) {
      connectionRef.current.onMessage(handler);
    }
  }, []);

  // クリーンアップ
  useEffect(
    () => () => {
      connectionRef.current?.close();
    },
    [],
  );

  return { state, roomId, open, close, disconnectAdmin, onMessage };
};
