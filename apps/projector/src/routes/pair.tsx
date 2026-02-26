import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import type { RoomMessage } from "@hackz/shared";
import { useRoomConnection } from "../hooks/useRoomConnection";
import type { RoomConnectionState } from "../hooks/useRoomConnection";
import { useRoomPolling } from "../hooks/useRoomPolling";
import { trpc } from "../lib/trpc";

type ScanEntry = {
  type: "NFC" | "QR";
  data: string;
  time: Date;
};

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

const PairPage = () => {
  const { state, roomId, open, close, disconnectAdmin } = useRoomConnection();
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [latestNfc, setLatestNfc] = useState<string | null>(null);
  const [latestQr, setLatestQr] = useState<{ userId: string; token: string } | null>(null);
  const [registerResult, setRegisterResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const openRef = useRef(open);
  const closeRef = useRef(close);
  openRef.current = open;
  closeRef.current = close;

  // ルーム作成
  useEffect(() => {
    openRef.current();
    return () => {
      closeRef.current();
    };
  }, []);

  // ペアリングURL生成
  const pairUrl = roomId
    ? (() => {
        const base = ADMIN_BASE.startsWith("http")
          ? ADMIN_BASE
          : `${window.location.origin}${ADMIN_BASE}`;
        return `${base.replace(/\/$/, "")}/connect/${roomId}`;
      })()
    : null;

  // Admin からのメッセージ
  const handleMessages = useCallback((messages: RoomMessage[]) => {
    for (const msg of messages) {
      switch (msg.type) {
        case "NFC_SCANNED": {
          const nfcId = (msg.payload as { nfcId: string }).nfcId;
          setLatestNfc(nfcId);
          setScans((prev) =>
            [{ type: "NFC" as const, data: nfcId, time: new Date() }, ...prev].slice(0, 50),
          );
          break;
        }
        case "QR_SCANNED": {
          const qrPayload = msg.payload as { userId: string; token: string };
          setLatestQr(qrPayload);
          setScans((prev) =>
            [
              { type: "QR" as const, data: `userId:${qrPayload.userId}`, time: new Date() },
              ...prev,
            ].slice(0, 50),
          );
          break;
        }
      }
    }
  }, []);

  useRoomPolling(roomId, "upstream", 1000, handleMessages);

  // 紐付け状態チェック
  const nfcCheck = trpc.auth.checkPairing.useQuery(
    { nfcId: latestNfc ?? undefined },
    { enabled: !!latestNfc },
  );
  const qrCheck = trpc.auth.checkPairing.useQuery(
    { userId: latestQr?.userId },
    { enabled: !!latestQr },
  );

  const nfcAlreadyLinked = nfcCheck.data?.nfcLinked ?? false;
  const qrAlreadyLinked = qrCheck.data?.userLinked ?? false;

  const registerPairing = trpc.auth.registerPairing.useMutation({
    onSuccess: (data) => {
      setRegisterResult({ success: true, message: `登録成功: ${data.user.name}` });
      setLatestNfc(null);
      setLatestQr(null);
    },
    onError: (error) => {
      setRegisterResult({ success: false, message: error.message });
    },
  });

  const handleRegister = useCallback(() => {
    if (!latestNfc || !latestQr) {
      return;
    }
    setRegisterResult(null);
    registerPairing.mutate({ nfcId: latestNfc, userId: latestQr.userId, token: latestQr.token });
  }, [latestNfc, latestQr, registerPairing]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      {/* ステータス */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(state)}`} />
        <span className="text-sm text-gray-400">{getStatusText(state)}</span>
        {state === "connected" && (
          <button
            type="button"
            onClick={disconnectAdmin}
            className="ml-2 px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
          >
            切断
          </button>
        )}
      </div>

      {/* 未接続: ペアリングURL表示 */}
      {state !== "connected" && pairUrl && (
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-3xl font-bold">ペアリング</h1>
          <QRCodeSVG value={pairUrl} size={280} bgColor="#111827" fgColor="#ffffff" level="M" />
          <p className="text-gray-400 text-sm max-w-md text-center">
            Android 端末で以下の URL を開いてください
          </p>
          <div className="bg-gray-800 rounded-lg px-4 py-2 max-w-lg">
            <code className="text-blue-400 text-xs break-all">{pairUrl}</code>
          </div>
          {roomId && <p className="text-xs text-gray-600">Room: {roomId}</p>}
        </div>
      )}

      {/* 接続済み: ペアリング登録 + スキャン結果表示 */}
      {state === "connected" && (
        <div className="flex flex-col items-center gap-6 w-full max-w-2xl px-4">
          <h1 className="text-3xl font-bold">接続済み</h1>

          {/* ペアリングカード */}
          <div className="w-full bg-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-center">ペアリング登録</h2>

            <div className="grid grid-cols-2 gap-4">
              {/* NFC */}
              <div
                className={`bg-gray-900 rounded-lg p-4 border ${nfcAlreadyLinked ? "border-red-500 bg-red-950/30" : "border-indigo-700"}`}
              >
                <p
                  className={`text-xs font-mono mb-1 ${nfcAlreadyLinked ? "text-red-400" : "text-indigo-400"}`}
                >
                  NFC ID
                </p>
                {latestNfc ? (
                  <>
                    <p
                      className={`text-sm font-mono break-all ${nfcAlreadyLinked ? "text-red-300" : "text-indigo-300"}`}
                    >
                      {latestNfc}
                    </p>
                    {nfcAlreadyLinked && (
                      <p className="text-xs text-red-400 mt-2">このNFCは既に紐付けされています</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">未受信</p>
                )}
              </div>

              {/* QR */}
              <div
                className={`bg-gray-900 rounded-lg p-4 border ${qrAlreadyLinked ? "border-red-500 bg-red-950/30" : "border-teal-700"}`}
              >
                <p
                  className={`text-xs font-mono mb-1 ${qrAlreadyLinked ? "text-red-400" : "text-teal-400"}`}
                >
                  QR userId
                </p>
                {latestQr ? (
                  <>
                    <p
                      className={`text-sm font-mono break-all ${qrAlreadyLinked ? "text-red-300" : "text-teal-300"}`}
                    >
                      {latestQr.userId}
                    </p>
                    {qrAlreadyLinked && (
                      <p className="text-xs text-red-400 mt-2">このQRは既に紐付けされています</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">未受信</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleRegister}
              disabled={
                !latestNfc ||
                !latestQr ||
                nfcAlreadyLinked ||
                qrAlreadyLinked ||
                registerPairing.isPending
              }
              className="w-full py-3 rounded-lg font-bold text-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {registerPairing.isPending ? "登録中..." : "登録"}
            </button>

            {registerResult && (
              <p
                className={`text-center text-sm ${registerResult.success ? "text-green-400" : "text-red-400"}`}
              >
                {registerResult.message}
              </p>
            )}
          </div>

          {/* スキャンログ */}
          <p className="text-green-400 text-sm">Admin 端末からスキャンデータを受信中</p>

          {scans.length === 0 ? (
            <p className="text-gray-500 text-sm">まだスキャンデータはありません</p>
          ) : (
            <div className="w-full space-y-2 max-h-[40vh] overflow-y-auto">
              {scans.map((scan, i) => (
                <div
                  key={`${scan.time.getTime()}-${i}`}
                  className={`p-3 rounded-lg ${scan.type === "NFC" ? "bg-indigo-900/50 border border-indigo-700" : "bg-teal-900/50 border border-teal-700"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded ${scan.type === "NFC" ? "bg-indigo-600" : "bg-teal-600"}`}
                    >
                      {scan.type}
                    </span>
                    <span className="text-xs text-gray-400">{scan.time.toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm font-mono break-all">{scan.data}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/pair")({
  component: PairPage,
});
