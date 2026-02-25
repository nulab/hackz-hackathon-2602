import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPeerServerConfig } from "@hackz/shared";
import type { DownstreamMessage } from "@hackz/shared";
import { AdminConnection } from "./AdminConnection";
import type { AdminConnectionState } from "./AdminConnection";

const API_URL = import.meta.env.VITE_API_URL || "/trpc";

export const useAdminConnection = () => {
  const connectionRef = useRef<AdminConnection | null>(null);
  const messageHandlerRef = useRef<((msg: DownstreamMessage) => void) | null>(null);
  const [state, setState] = useState<AdminConnectionState>("disconnected");

  const peerConfig = useMemo(() => getPeerServerConfig(API_URL), []);

  const connect = useCallback(
    (projectorPeerId: string) => {
      const conn = new AdminConnection();
      connectionRef.current = conn;
      conn.onStateChange(setState);

      if (messageHandlerRef.current) {
        conn.onMessage(messageHandlerRef.current);
      }

      conn.connect(projectorPeerId, peerConfig);
    },
    [peerConfig],
  );

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
  }, []);

  const sendNfcScan = useCallback((nfcId: string) => {
    connectionRef.current?.send({ type: "NFC_SCANNED", nfcId });
  }, []);

  const sendQrScan = useCallback((data: string) => {
    connectionRef.current?.send({ type: "QR_SCANNED", data });
  }, []);

  const onMessage = useCallback((handler: (msg: DownstreamMessage) => void) => {
    messageHandlerRef.current = handler;
    if (connectionRef.current) {
      connectionRef.current.onMessage(handler);
    }
  }, []);

  // クリーンアップ
  useEffect(
    () => () => {
      connectionRef.current?.disconnect();
    },
    [],
  );

  return { state, connect, disconnect, sendNfcScan, sendQrScan, onMessage };
};
