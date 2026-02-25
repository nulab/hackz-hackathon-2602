import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Html5Qrcode } from "html5-qrcode";
import type { DownstreamMessage } from "@hackz/shared";
import { useAdminConnection } from "../webrtc/useAdminConnection";
import type { AdminConnectionState } from "../webrtc/AdminConnection";

type ScanFeedback = { success: boolean; message: string } | null;

const getStatusColor = (state: AdminConnectionState): string => {
  switch (state) {
    case "connected":
      return "bg-green-500";
    case "connecting":
      return "bg-yellow-500 animate-pulse";
    case "reconnecting":
      return "bg-orange-500 animate-pulse";
    default:
      return "bg-red-500";
  }
};

const getStatusText = (state: AdminConnectionState): string => {
  switch (state) {
    case "connected":
      return "接続済み";
    case "connecting":
      return "接続中...";
    case "reconnecting":
      return "再接続中...";
    default:
      return "未接続";
  }
};

const AdminPage = () => {
  const { state, connect, disconnect, sendNfcScan, onMessage } = useAdminConnection();
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // スキャン結果のフィードバック処理
  const handleMessage = useCallback((msg: DownstreamMessage) => {
    if (msg.type === "SCAN_RESULT") {
      setFeedback({
        success: msg.success,
        message: msg.message ?? (msg.success ? "成功" : "失敗"),
      });
      setTimeout(() => setFeedback(null), 3000);
    }
    if (msg.type === "DISCONNECT") {
      setFeedback({ success: false, message: `切断: ${msg.reason}` });
    }
  }, []);

  useEffect(() => {
    onMessage(handleMessage);
  }, [onMessage, handleMessage]);

  // QR コードスキャン開始
  const startQrScan = useCallback(async () => {
    if (scannerRef.current) {
      return;
    }
    setScanning(true);
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        await scanner.stop();
        scannerRef.current = null;
        setScanning(false);
        // QR の中身が roomId → Projector に接続
        await connect(decodedText);
      },
      () => {}, // scan failure (continuous, not an error)
    );
  }, [connect]);

  // NFC スキャン（テスト用ボタン）
  const handleNfcInput = useCallback(() => {
    const nfcId = prompt("NFC ID を入力:");
    if (nfcId) {
      sendNfcScan(nfcId);
    }
  }, [sendNfcScan]);

  // クリーンアップ
  useEffect(
    () => () => {
      scannerRef.current?.stop().catch(() => {});
    },
    [],
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      {/* 接続ステータス */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(state)}`} />
        <span className="text-sm text-gray-600">{getStatusText(state)}</span>
      </div>

      {/* フィードバック */}
      {feedback && (
        <div
          className={`fixed top-16 inset-x-4 p-4 rounded-lg text-center text-white font-bold text-lg ${
            feedback.success ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* 未接続: QR スキャン画面 */}
      {state === "disconnected" && (
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-2xl font-bold text-gray-800">Admin 端末</h2>
          <p className="text-gray-600">Projector の QR コードをスキャンして接続</p>
          <div id="qr-reader" className="w-[300px] h-[300px]" />
          {!scanning && (
            <button
              type="button"
              onClick={startQrScan}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
            >
              QR コードをスキャン
            </button>
          )}
        </div>
      )}

      {/* 接続中 */}
      {(state === "connecting" || state === "reconnecting") && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">
            {state === "connecting" ? "Projector に接続中..." : "再接続中..."}
          </p>
        </div>
      )}

      {/* 接続済み: スキャン待ち画面 */}
      {state === "connected" && (
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-2xl font-bold text-gray-800">スキャン待ち</h2>
          <p className="text-gray-600">NFC タグをかざすか QR コードを読み取ってください</p>

          <button
            type="button"
            onClick={handleNfcInput}
            className="w-full max-w-xs px-6 py-4 bg-indigo-600 text-white rounded-lg font-bold text-lg hover:bg-indigo-700"
          >
            NFC スキャン（テスト）
          </button>

          <button
            type="button"
            onClick={disconnect}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            切断
          </button>
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: AdminPage,
});
