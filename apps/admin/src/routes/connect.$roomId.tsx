import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { DownstreamMessage } from "@hackz/shared";
import { useAdminConnection } from "../webrtc/useAdminConnection";
import type { AdminConnectionState } from "../webrtc/AdminConnection";
import { useNfcReader } from "../hooks/useNfcReader";
import { useQrScanner } from "../hooks/useQrScanner";

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

const ConnectPage = () => {
  const { roomId: routeRoomId } = Route.useParams();
  const { state, connect, disconnect, sendNfcScan, sendQrScan, onMessage } = useAdminConnection();
  const {
    isSupported: nfcSupported,
    isReading,
    lastRead,
    error: nfcError,
    startReading,
    stopReading,
  } = useNfcReader();
  const { isScanning, error: qrError, startScan, stopScan } = useQrScanner("qr-scanner");
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const [scanLog, setScanLog] = useState<{ type: string; data: string; time: Date }[]>([]);
  const connectCalledRef = useRef(false);

  // 自動接続
  useEffect(() => {
    if (connectCalledRef.current) {
      return;
    }
    connectCalledRef.current = true;
    connect(routeRoomId);
  }, [routeRoomId, connect]);

  // NFC 読み取り結果を送信
  useEffect(() => {
    if (!lastRead) {
      return;
    }
    const nfcId = lastRead.serialNumber || lastRead.records[0]?.data || "";
    if (nfcId) {
      sendNfcScan(nfcId);
      setScanLog((prev) => [{ type: "NFC", data: nfcId, time: new Date() }, ...prev].slice(0, 20));
    }
  }, [lastRead, sendNfcScan]);

  // Projector からのメッセージ
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

  // QR スキャン結果を送信
  const handleQrScan = useCallback(
    (data: string) => {
      sendQrScan(data);
      setScanLog((prev) => [{ type: "QR", data, time: new Date() }, ...prev].slice(0, 20));
    },
    [sendQrScan],
  );

  // NFC テスト入力（非対応環境用）
  const handleNfcTestInput = useCallback(() => {
    const nfcId = prompt("NFC ID を入力:");
    if (nfcId) {
      sendNfcScan(nfcId);
      setScanLog((prev) =>
        [{ type: "NFC(test)", data: nfcId, time: new Date() }, ...prev].slice(0, 20),
      );
    }
  }, [sendNfcScan]);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4">
      {/* 接続ステータス */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-10">
        <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(state)}`} />
        <span className="text-sm text-gray-600">{getStatusText(state)}</span>
      </div>

      {/* フィードバック */}
      {feedback && (
        <div
          className={`fixed top-16 inset-x-4 p-4 rounded-lg text-center text-white font-bold text-lg z-20 ${
            feedback.success ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* 接続中 */}
      {(state === "connecting" || state === "reconnecting") && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Projector に接続中...</p>
          <p className="text-xs text-gray-400">Room: {routeRoomId}</p>
        </div>
      )}

      {/* 接続済み: スキャンUI */}
      {state === "connected" && (
        <div className="flex flex-col items-center gap-6 w-full max-w-md pt-8">
          <h2 className="text-2xl font-bold text-gray-800">スキャン待ち</h2>

          {/* NFC セクション */}
          <div className="w-full bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-3">NFC</h3>
            {nfcSupported ? (
              <>
                {!isReading ? (
                  <button
                    type="button"
                    onClick={startReading}
                    className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                  >
                    NFC 読み取り開始
                  </button>
                ) : (
                  <div className="text-center">
                    <div className="text-green-600 font-semibold mb-2">NFC 読み取り中...</div>
                    <p className="text-sm text-gray-500">タグをかざしてください</p>
                    <button
                      type="button"
                      onClick={stopReading}
                      className="mt-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      停止
                    </button>
                  </div>
                )}
                {nfcError && <p className="text-red-500 text-sm mt-2">{nfcError}</p>}
              </>
            ) : (
              <div>
                <p className="text-sm text-gray-400 mb-2">Web NFC 非対応環境</p>
                <button
                  type="button"
                  onClick={handleNfcTestInput}
                  className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700"
                >
                  NFC テスト入力
                </button>
              </div>
            )}
          </div>

          {/* QR セクション */}
          <div className="w-full bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-3">QR コード</h3>
            <div id="qr-scanner" className="w-full" />
            {!isScanning ? (
              <button
                type="button"
                onClick={() => startScan(handleQrScan)}
                className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700"
              >
                QR スキャン開始
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScan}
                className="w-full px-4 py-3 bg-gray-400 text-white rounded-lg font-bold hover:bg-gray-500 mt-2"
              >
                QR スキャン停止
              </button>
            )}
            {qrError && <p className="text-red-500 text-sm mt-2">{qrError}</p>}
          </div>

          {/* スキャンログ */}
          {scanLog.length > 0 && (
            <div className="w-full bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-2">スキャン履歴</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {scanLog.map((log, i) => (
                  <div
                    key={`${log.time.getTime()}-${i}`}
                    className="text-xs text-gray-600 flex gap-2"
                  >
                    <span
                      className={`font-mono px-1 rounded ${log.type.startsWith("NFC") ? "bg-indigo-100" : "bg-teal-100"}`}
                    >
                      {log.type}
                    </span>
                    <span className="truncate">{log.data}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              stopReading();
              stopScan();
              disconnect();
            }}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            切断
          </button>
        </div>
      )}

      {/* 切断時 */}
      {state === "disconnected" && connectCalledRef.current && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <p className="text-gray-600">切断されました</p>
          <button
            type="button"
            onClick={() => {
              connectCalledRef.current = false;
              connect(routeRoomId);
              connectCalledRef.current = true;
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
          >
            再接続
          </button>
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/connect/$roomId")({
  component: ConnectPage,
});
