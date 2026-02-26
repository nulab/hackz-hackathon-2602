import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useNfcReader } from "../hooks/useNfcReader";
import { trpc } from "../lib/trpc";

type ScanPhase = "idle" | "loading" | "result";
type ScanResult = { found: boolean; userName?: string; userId?: string } | null;

const AdminPage = () => {
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
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const setActiveUser = trpc.projectorViewer.setActiveUser.useMutation();
  const clearActiveUser = trpc.projectorViewer.clearActiveUser.useMutation();

  const handleNfcId = useCallback(
    async (nfcId: string) => {
      if (phaseRef.current !== "idle") {
        return;
      }
      setPhase("loading");

      try {
        const res = await setActiveUser.mutateAsync({ nfcId });
        if (res.success) {
          setResult({ found: true, userId: res.userId ?? undefined });
        } else {
          setResult({ found: false });
        }
      } catch {
        setResult({ found: false });
      }

      setPhase("result");
      setTimeout(() => {
        setPhase("idle");
        setResult(null);
      }, 3000);
    },
    [setActiveUser],
  );

  // NFC 読み取り結果を処理
  useEffect(() => {
    if (!lastRead) {
      return;
    }
    if (phaseRef.current !== "idle") {
      return;
    }
    const nfcId = lastRead.serialNumber || lastRead.records[0]?.data || "";
    if (nfcId) {
      handleNfcId(nfcId);
    }
  }, [lastRead, handleNfcId]);

  // NFC テスト入力（Web NFC 非対応環境用）
  const handleTestInput = useCallback(() => {
    if (phaseRef.current !== "idle") {
      return;
    }
    const nfcId = prompt("NFC ID を入力:");
    if (nfcId) {
      handleNfcId(nfcId);
    }
  }, [handleNfcId]);

  const handleClear = useCallback(() => {
    clearActiveUser.mutate();
  }, [clearActiveUser]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
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
          <h2 className="text-2xl font-bold text-gray-800">NFC タグをかざしてください</h2>

          {nfcSupported ? (
            <>
              {!isReading ? (
                <button
                  type="button"
                  onClick={startReading}
                  className="w-full max-w-xs px-4 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
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
            <div className="w-full max-w-xs">
              <p className="text-sm text-gray-400 mb-2 text-center">Web NFC 非対応環境</p>
              <button
                type="button"
                onClick={handleTestInput}
                className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700"
              >
                NFC テスト入力
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600"
          >
            表示をクリア
          </button>
        </div>
      )}

      {/* loading: サーバー応答待ち */}
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
              <p className="text-2xl font-bold text-gray-800">ユーザー設定完了</p>
              {result.userId && <p className="text-sm text-gray-500">{result.userId}</p>}
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
              <p className="text-xl font-bold text-gray-600">未登録のタグです</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: AdminPage,
});
