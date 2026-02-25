import { useCallback, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import type { UpstreamMessage } from "@hackz/shared";
import { useProjectorConnection } from "../webrtc/useProjectorConnection";

const ProjectorPage = () => {
  const { state, roomId, open, close, disconnectAdmin, onMessage } = useProjectorConnection();

  // 起動時にルームを作成
  useEffect(() => {
    open();
    return () => {
      close();
    };
  }, []);

  // Admin からのメッセージを処理
  const handleMessage = useCallback((msg: UpstreamMessage) => {
    switch (msg.type) {
      case "NFC_SCANNED":
        console.log("NFC scanned:", msg.nfcId);
        // TODO: tRPC で auth.nfcLogin を呼んで結果を Admin に返す
        break;
      case "QR_SCANNED":
        console.log("QR scanned:", msg.data);
        // TODO: QR データを処理して結果を Admin に返す
        break;
    }
  }, []);

  useEffect(() => {
    onMessage(handleMessage);
  }, [onMessage, handleMessage]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      {/* 接続ステータス */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span
          className={`inline-block w-3 h-3 rounded-full ${
            state === "connected"
              ? "bg-green-500"
              : state === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : state === "waiting"
                  ? "bg-blue-500 animate-pulse"
                  : "bg-red-500"
          }`}
        />
        <span className="text-sm text-gray-400">
          {state === "connected"
            ? "Admin 接続中"
            : state === "connecting"
              ? "接続中..."
              : state === "waiting"
                ? "Admin 待ち"
                : "未接続"}
        </span>
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

      {/* メインコンテンツ */}
      {state !== "connected" ? (
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-3xl font-bold">Idol Interactive Demo</h1>
          {roomId && (
            <>
              <QRCodeSVG value={roomId} size={256} bgColor="#111827" fgColor="#ffffff" level="M" />
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
