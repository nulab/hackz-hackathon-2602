import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { RoomMessage } from "@hackz/shared";
import { useAdminRoomConnection } from "../hooks/useAdminRoomConnection";
import type { AdminConnectionState } from "../hooks/useAdminRoomConnection";
import { useRoomPolling } from "../hooks/useRoomPolling";
import { useNfcReader } from "../hooks/useNfcReader";

type ScanPhase = "idle" | "loading" | "result";
type ScanResult = { found: boolean; userName?: string; message: string } | null;

const getStatusColor = (state: AdminConnectionState): string => {
  switch (state) {
    case "connected":
      return "bg-green-500";
    case "connecting":
      return "bg-yellow-500 animate-pulse";
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
    default:
      return "未接続";
  }
};

const ScanPage = () => {
  const { roomId: routeRoomId } = Route.useParams();
  const { state, roomId, connect, disconnect, sendNfcScan } = useAdminRoomConnection();
  const {
    isSupported: nfcSupported,
    isReading,
    lastRead,
    error: nfcError,
    startReading,
    stopReading,
  } = useNfcReader();

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [result, setResult] = useState<ScanResult>(null);
  const connectCalledRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // 自動接続
  useEffect(() => {
    if (connectCalledRef.current) {
      return;
    }
    connectCalledRef.current = true;
    connect(routeRoomId);
  }, [routeRoomId, connect]);

  // NFC 読み取り結果を送信（idle 状態のときだけ受け付ける）
  useEffect(() => {
    if (!lastRead) {
      return;
    }
    if (phaseRef.current !== "idle") {
      return;
    }
    const nfcId = lastRead.serialNumber || lastRead.records[0]?.data || "";
    if (nfcId) {
      sendNfcScan(nfcId);
      setPhase("loading");
    }
  }, [lastRead, sendNfcScan]);

  // Projector からのダウンストリームメッセージをポーリング
  const handleDownstreamMessages = useCallback((messages: RoomMessage[]) => {
    for (const msg of messages) {
      if (msg.type === "NFC_RESULT") {
        const payload = msg.payload as { found: boolean; userName?: string };
        setResult({
          found: payload.found,
          userName: payload.userName,
          message: payload.found ? `${payload.userName}` : "未登録のタグです",
        });
        setPhase("result");
        setTimeout(() => {
          setPhase("idle");
          setResult(null);
        }, 3000);
      }
    }
  }, []);

  useRoomPolling(
    state === "connected" ? roomId : null,
    "downstream",
    1000,
    handleDownstreamMessages,
  );

  // NFC テスト入力（非対応環境用）
  const handleNfcTestInput = useCallback(() => {
    if (phaseRef.current !== "idle") {
      return;
    }
    const nfcId = prompt("NFC ID を入力:");
    if (nfcId) {
      sendNfcScan(nfcId);
      setPhase("loading");
    }
  }, [sendNfcScan]);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4">
      {/* 接続ステータス */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-10">
        <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(state)}`} />
        <span className="text-sm text-gray-600">{getStatusText(state)}</span>
      </div>

      {/* 接続中 */}
      {state === "connecting" && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Projector に接続中...</p>
          <p className="text-xs text-gray-400">Room: {routeRoomId}</p>
        </div>
      )}

      {/* 接続済み */}
      {state === "connected" && (
        <div className="flex flex-col items-center justify-center flex-1 gap-6 w-full max-w-md">
          {/* idle: NFC 読み取り待ち */}
          {phase === "idle" && (
            <div className="flex flex-col items-center gap-6">
              <div className="w-32 h-32 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg
                  className="w-16 h-16 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">タグをかざしてください</h2>

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
                      <div className="text-green-600 font-semibold">NFC 読み取り中...</div>
                      <button
                        type="button"
                        onClick={stopReading}
                        className="mt-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                      >
                        停止
                      </button>
                    </div>
                  )}
                  {nfcError && <p className="text-red-500 text-sm">{nfcError}</p>}
                </>
              ) : (
                <div className="w-full">
                  <p className="text-sm text-gray-400 mb-2 text-center">Web NFC 非対応環境</p>
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
          )}

          {/* loading: 応答待ち */}
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-lg font-semibold text-gray-700">読み取り中...</p>
            </div>
          )}

          {/* result: 結果表示 */}
          {phase === "result" && result && (
            <div className="flex flex-col items-center gap-4">
              {result.found ? (
                <>
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{result.userName}</p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-red-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-xl font-bold text-gray-600">{result.message}</p>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              stopReading();
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

export const Route = createFileRoute("/scan/$roomId")({
  component: ScanPage,
});
