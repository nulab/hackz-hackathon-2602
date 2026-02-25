import { useCallback, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import type { RoomMessage } from "@hackz/shared";
import { useRoomConnection } from "../hooks/useRoomConnection";
import type { RoomConnectionState } from "../hooks/useRoomConnection";
import { useRoomPolling } from "../hooks/useRoomPolling";

const ADMIN_BASE = import.meta.env.VITE_ADMIN_URL || "/hackz-hackathon-2602/admin";

const getStatusColor = (state: RoomConnectionState): string => {
  switch (state) {
    case "connected":
      return "bg-green-500";
    case "waiting":
      return "bg-blue-500 animate-pulse";
    default:
      return "bg-red-500";
  }
};

const getStatusText = (state: RoomConnectionState): string => {
  switch (state) {
    case "connected":
      return "Admin 接続中";
    case "waiting":
      return "Admin 待ち";
    default:
      return "未接続";
  }
};

const ProjectorPage = () => {
  const { state, roomId, open, close, disconnectAdmin } = useRoomConnection();
  const openRef = useRef(open);
  const closeRef = useRef(close);
  openRef.current = open;
  closeRef.current = close;

  useEffect(() => {
    openRef.current();
    return () => {
      closeRef.current();
    };
  }, []);

  const handleMessages = useCallback((messages: RoomMessage[]) => {
    for (const msg of messages) {
      switch (msg.type) {
        case "NFC_SCANNED":
          // TODO: tRPC で auth.nfcLogin を呼んで結果を Admin に返す
          break;
        case "QR_SCANNED":
          // TODO: QR データを処理して結果を Admin に返す
          break;
      }
    }
  }, []);

  useRoomPolling(roomId, "upstream", 1000, handleMessages);

  // Generate admin connection URL
  const pairUrl = roomId
    ? (() => {
        const base = ADMIN_BASE.startsWith("http")
          ? ADMIN_BASE
          : `${window.location.origin}${ADMIN_BASE}`;
        return `${base.replace(/\/$/, "")}/connect/${roomId}`;
      })()
    : null;

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(state)}`} />
        <span className="text-sm text-gray-400">{getStatusText(state)}</span>
        {state === "connected" && (
          <button
            type="button"
            onClick={disconnectAdmin}
            className="ml-2 px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
          >
            Admin を切断
          </button>
        )}
      </div>

      {state !== "connected" ? (
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-3xl font-bold">Idol Interactive Demo</h1>
          {pairUrl && (
            <>
              <QRCodeSVG value={pairUrl} size={256} bgColor="#111827" fgColor="#ffffff" level="M" />
              <p className="text-gray-400">Admin 端末でこの QR コードを読み取ってください</p>
              <p className="text-xs text-gray-600">Room: {roomId}</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold">Idol Interactive Demo</h1>
          <p className="text-xl text-gray-400">Projector Display</p>
          <p className="text-green-400">Admin 端末が接続されています</p>
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: ProjectorPage,
});
