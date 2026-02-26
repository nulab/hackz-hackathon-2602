import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import type { RoomMessage } from "@hackz/shared";
import { useRoomConnection } from "../hooks/useRoomConnection";
import type { RoomConnectionState } from "../hooks/useRoomConnection";
import { useRoomPolling } from "../hooks/useRoomPolling";
import { trpc } from "../lib/trpc";

type LookedUpUser = {
  id: string;
  name: string;
  photoUrl: string | null;
  totalScore: number;
};

type DisplayState =
  | { type: "idle" }
  | { type: "looking_up"; nfcId: string }
  | { type: "found"; user: LookedUpUser }
  | { type: "not_found"; nfcId: string };

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
  const [display, setDisplay] = useState<DisplayState>({ type: "idle" });
  const openRef = useRef(open);
  const closeRef = useRef(close);
  openRef.current = open;
  closeRef.current = close;

  const processingRef = useRef(false);
  const queueRef = useRef<string[]>([]);

  const utils = trpc.useUtils();
  const sendMutation = trpc.room.send.useMutation();
  const sendRef = useRef(sendMutation.mutate);
  sendRef.current = sendMutation.mutate;

  const setActiveUserMutation = trpc.projectorViewer.setActiveUser.useMutation();
  const setActiveRef = useRef(setActiveUserMutation.mutate);
  setActiveRef.current = setActiveUserMutation.mutate;

  useEffect(() => {
    openRef.current();
    return () => {
      closeRef.current();
    };
  }, []);

  // NFC ID を処理する（1本ずつ）
  const processNfc = useCallback(
    async (nfcId: string) => {
      if (!roomId) {
        return;
      }

      setDisplay({ type: "looking_up", nfcId });

      try {
        const result = await utils.users.findByNfc.fetch({ nfcId });

        if (result.found && result.user) {
          setDisplay({ type: "found", user: result.user });
          setActiveRef.current({ nfcId });

          sendRef.current({
            roomId,
            channel: "downstream",
            message: {
              type: "NFC_RESULT",
              payload: { found: true, userName: result.user.name },
            },
          });
        } else {
          setDisplay({ type: "not_found", nfcId });

          sendRef.current({
            roomId,
            channel: "downstream",
            message: {
              type: "NFC_RESULT",
              payload: { found: false },
            },
          });
        }
      } catch {
        setDisplay({ type: "not_found", nfcId });

        sendRef.current({
          roomId,
          channel: "downstream",
          message: {
            type: "NFC_RESULT",
            payload: { found: false },
          },
        });
      }
    },
    [roomId, utils.users.findByNfc],
  );

  // キューから次の NFC ID を処理
  const processQueue = useCallback(async () => {
    if (processingRef.current) {
      return;
    }
    const next = queueRef.current.shift();
    if (!next) {
      return;
    }
    processingRef.current = true;
    await processNfc(next);
    processingRef.current = false;
    processQueue();
  }, [processNfc]);

  // Admin からのメッセージを受信
  const handleMessages = useCallback(
    (messages: RoomMessage[]) => {
      for (const msg of messages) {
        if (msg.type === "NFC_SCANNED") {
          const { nfcId } = msg.payload as { nfcId: string };
          queueRef.current.push(nfcId);
          processQueue();
        }
      }
    },
    [processQueue],
  );

  useRoomPolling(roomId, "upstream", 1000, handleMessages);

  // Admin 用 QR URL
  const scanUrl = roomId
    ? (() => {
        const base = ADMIN_BASE.startsWith("http")
          ? ADMIN_BASE
          : `${window.location.origin}${ADMIN_BASE}`;
        return `${base.replace(/\/$/, "")}/scan/${roomId}`;
      })()
    : null;

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
            Admin を切断
          </button>
        )}
      </div>

      {/* 未接続: QR コード表示 */}
      {state !== "connected" ? (
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-3xl font-bold">NFC スキャン</h1>
          {scanUrl && (
            <>
              <QRCodeSVG value={scanUrl} size={256} bgColor="#111827" fgColor="#ffffff" level="M" />
              <p className="text-gray-400">Admin 端末でこの QR コードを読み取ってください</p>
              <p className="text-xs text-gray-600">Room: {roomId}</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8 w-full max-w-2xl px-4">
          {/* idle: 待機中 */}
          {display.type === "idle" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-gray-500"
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
              <h2 className="text-2xl font-bold">NFC タグ待ち</h2>
              <p className="text-gray-400">Admin 端末で NFC タグをスキャンしてください</p>
            </div>
          )}

          {/* looking_up: 検索中 */}
          {display.type === "looking_up" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <h2 className="text-2xl font-bold">ユーザー検索中...</h2>
              <p className="text-gray-500 font-mono text-sm">{display.nfcId}</p>
            </div>
          )}

          {/* found: ユーザー情報表示 */}
          {display.type === "found" && (
            <div className="flex flex-col items-center gap-6 animate-fade-in">
              {display.user.photoUrl ? (
                <img
                  src={display.user.photoUrl}
                  alt={display.user.name}
                  className="w-32 h-32 rounded-full object-cover border-4 border-green-500"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-green-900 flex items-center justify-center border-4 border-green-500">
                  <span className="text-5xl font-bold text-green-300">
                    {display.user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <h2 className="text-4xl font-bold">{display.user.name}</h2>
              <div className="flex items-center gap-2 text-xl">
                <span className="text-yellow-400">★</span>
                <span className="text-gray-300">スコア: {display.user.totalScore}</span>
              </div>
            </div>
          )}

          {/* not_found: 未登録 */}
          {display.type === "not_found" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-red-900/50 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-red-400">未登録のタグです</h2>
              <p className="text-gray-500 font-mono text-sm">{display.nfcId}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: ProjectorPage,
});
