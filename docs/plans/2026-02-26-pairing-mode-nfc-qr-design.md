# Pairing Mode + Web NFC/QR Scan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Projector に `/pair` ルートを新設し、ペアリングURLを表示。Android でそのURLを開くと Admin の `/connect/$roomId` に到達し、WebRTC 接続確立後に Web NFC と QR スキャンの結果が Projector にリアルタイム表示される。

**Architecture:** 既存の WebRTC インフラ（`useProjectorConnection`, `useAdminConnection`, tRPC signaling router）を再利用。Projector 側に新ルート `/pair` を追加して roomId 入り URL を生成・表示し、Admin 側に `/connect/$roomId` ルートを追加して URL パラメータから自動接続。接続後は Web NFC API + html5-qrcode でスキャン → DataChannel 経由で Projector に送信。

**Tech Stack:** React 19, TanStack Router (file-based), tRPC, WebRTC DataChannel, Web NFC API, html5-qrcode, Tailwind CSS 4

---

### Task 1: Web NFC Reader Hook

**Files:**

- Create: `apps/admin/src/hooks/useNfcReader.ts`

**Step 1: Create the hook**

```ts
import { useCallback, useEffect, useRef, useState } from "react";

type NfcReadResult = {
  serialNumber: string;
  records: Array<{ recordType: string; data: string }>;
};

export const useNfcReader = () => {
  const [isSupported] = useState(() => "NDEFReader" in window);
  const [isReading, setIsReading] = useState(false);
  const [lastRead, setLastRead] = useState<NfcReadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<NDEFReader | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startReading = useCallback(async () => {
    if (!isSupported) {
      setError("Web NFC is not supported on this device");
      return;
    }
    try {
      const reader = new NDEFReader();
      readerRef.current = reader;
      const abort = new AbortController();
      abortRef.current = abort;

      reader.onreading = (event: NDEFReadingEvent) => {
        const records = Array.from(event.message.records).map((r) => ({
          recordType: r.recordType,
          data: new TextDecoder().decode(r.data),
        }));
        setLastRead({ serialNumber: event.serialNumber ?? "", records });
      };

      reader.onreadingerror = () => {
        setError("NFC read error");
      };

      await reader.scan({ signal: abort.signal });
      setIsReading(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start NFC reader");
      setIsReading(false);
    }
  }, [isSupported]);

  const stopReading = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    readerRef.current = null;
    setIsReading(false);
  }, []);

  useEffect(() => () => stopReading(), [stopReading]);

  return { isSupported, isReading, lastRead, error, startReading, stopReading };
};
```

**Step 2: Add Web NFC type declarations**

Create `apps/admin/src/types/web-nfc.d.ts`:

```ts
interface NDEFReader {
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
  scan(options?: { signal?: AbortSignal }): Promise<void>;
}

interface NDEFReadingEvent extends Event {
  serialNumber: string | null;
  message: NDEFMessage;
}

interface NDEFMessage {
  records: ReadonlyArray<NDEFRecord>;
}

interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: DataView;
  encoding?: string;
  lang?: string;
}

declare const NDEFReader: {
  prototype: NDEFReader;
  new (): NDEFReader;
};
```

**Step 3: Verify build**

Run: `cd apps/admin && bunx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add apps/admin/src/hooks/useNfcReader.ts apps/admin/src/types/web-nfc.d.ts
git commit -m "feat(admin): add Web NFC reader hook with type declarations"
```

---

### Task 2: QR Scanner Hook

**Files:**

- Create: `apps/admin/src/hooks/useQrScanner.ts`

**Step 1: Create the hook**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export const useQrScanner = (elementId: string) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const callbackRef = useRef<((data: string) => void) | null>(null);

  const startScan = useCallback(
    async (onScan: (data: string) => void) => {
      if (scannerRef.current) return;
      setError(null);
      callbackRef.current = onScan;

      try {
        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;
        setIsScanning(true);

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            callbackRef.current?.(decodedText);
          },
          () => {},
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start QR scanner");
        setIsScanning(false);
        scannerRef.current = null;
      }
    },
    [elementId],
  );

  const stopScan = useCallback(async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
    } catch {
      // ignore stop errors
    }
    scannerRef.current = null;
    callbackRef.current = null;
    setIsScanning(false);
  }, []);

  useEffect(
    () => () => {
      scannerRef.current?.stop().catch(() => {});
    },
    [],
  );

  return { isScanning, error, startScan, stopScan };
};
```

**Step 2: Verify build**

Run: `cd apps/admin && bunx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/admin/src/hooks/useQrScanner.ts
git commit -m "feat(admin): add QR scanner hook wrapping html5-qrcode"
```

---

### Task 3: Admin `/connect/$roomId` Route

**Files:**

- Create: `apps/admin/src/routes/connect.$roomId.tsx`

**Step 1: Create the route**

```tsx
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
  const [scanLog, setScanLog] = useState<Array<{ type: string; data: string; time: Date }>>([]);
  const connectCalledRef = useRef(false);

  // 自動接続
  useEffect(() => {
    if (connectCalledRef.current) return;
    connectCalledRef.current = true;
    connect(routeRoomId);
  }, [routeRoomId, connect]);

  // NFC 読み取り結果を送信
  useEffect(() => {
    if (!lastRead) return;
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
```

**Step 2: Verify the route is auto-generated**

Run: `cd apps/admin && bunx tsc --noEmit`
Expected: No type errors (TanStack Router Vite plugin auto-generates route tree)

**Step 3: Commit**

```bash
git add apps/admin/src/routes/connect.\$roomId.tsx
git commit -m "feat(admin): add /connect/:roomId route with auto-connect, NFC and QR scanning"
```

---

### Task 4: Projector `/pair` Route

**Files:**

- Create: `apps/projector/src/routes/pair.tsx`

**Step 1: Create the route**

The Projector pair page reuses `useProjectorConnection` to create a room, then constructs
an Admin URL using the `VITE_ADMIN_URL` env var (fallback to relative path for same-origin deploy).

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import type { UpstreamMessage } from "@hackz/shared";
import { useProjectorConnection } from "../webrtc/useProjectorConnection";
import type { ProjectorConnectionState } from "../webrtc/ProjectorConnection";

type ScanEntry = {
  type: "NFC" | "QR";
  data: string;
  time: Date;
};

const ADMIN_BASE = import.meta.env.VITE_ADMIN_URL || "/hackz-hackathon-2602/admin";

const getStatusColor = (state: ProjectorConnectionState): string => {
  switch (state) {
    case "connected":
      return "bg-green-500";
    case "connecting":
      return "bg-yellow-500 animate-pulse";
    case "waiting":
      return "bg-blue-500 animate-pulse";
    default:
      return "bg-red-500";
  }
};

const getStatusText = (state: ProjectorConnectionState): string => {
  switch (state) {
    case "connected":
      return "Admin 接続中";
    case "connecting":
      return "接続中...";
    case "waiting":
      return "Admin 待ち";
    default:
      return "未接続";
  }
};

const PairPage = () => {
  const { state, roomId, open, close, disconnectAdmin, onMessage } = useProjectorConnection();
  const [pairUrl, setPairUrl] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanEntry[]>([]);
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
  useEffect(() => {
    if (!roomId) return;
    const base = ADMIN_BASE.startsWith("http")
      ? ADMIN_BASE
      : `${window.location.origin}${ADMIN_BASE}`;
    const url = `${base.replace(/\/$/, "")}/connect/${roomId}`;
    setPairUrl(url);
  }, [roomId]);

  // Admin からのメッセージ
  const handleMessage = useCallback((msg: UpstreamMessage) => {
    switch (msg.type) {
      case "NFC_SCANNED":
        setScans((prev) =>
          [{ type: "NFC", data: msg.nfcId, time: new Date() }, ...prev].slice(0, 50),
        );
        break;
      case "QR_SCANNED":
        setScans((prev) =>
          [{ type: "QR", data: msg.data, time: new Date() }, ...prev].slice(0, 50),
        );
        break;
    }
  }, []);

  useEffect(() => {
    onMessage(handleMessage);
  }, [onMessage, handleMessage]);

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

      {/* 接続済み: スキャン結果表示 */}
      {state === "connected" && (
        <div className="flex flex-col items-center gap-6 w-full max-w-2xl px-4">
          <h1 className="text-3xl font-bold">接続済み</h1>
          <p className="text-green-400">Admin 端末からスキャンデータを受信中</p>

          {scans.length === 0 ? (
            <p className="text-gray-500 text-sm">まだスキャンデータはありません</p>
          ) : (
            <div className="w-full space-y-2 max-h-[60vh] overflow-y-auto">
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
```

**Step 2: Verify build**

Run: `cd apps/projector && bunx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/projector/src/routes/pair.tsx
git commit -m "feat(projector): add /pair route showing pairing URL and scan results"
```

---

### Task 5: Full Build Verification

**Step 1: Run full project build**

Run: `bun run build`
Expected: All 3 apps build successfully

**Step 2: Run lint**

Run: `bun run lint`
Expected: No lint errors

**Step 3: Run format**

Run: `bun run format`
Expected: No format errors (or fix with `bun run format:fix`)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint and format issues"
```

---

### Task 6: Manual Integration Test

**Step 1: Start development servers**

Run: `bun run dev`
Expected: All apps start (admin on :5175, projector on :5174, server on :3000)

**Step 2: Test the pairing flow**

1. Open Projector: `http://localhost:5174/hackz-hackathon-2602/projector/pair`
2. Verify: QR code + URL is displayed
3. Open the displayed URL in another browser tab (simulating Android)
4. Verify: Admin auto-connects, Projector shows "Admin 接続中"
5. On Admin page: click "NFC テスト入力" → enter test ID
6. Verify: Projector shows NFC scan entry
7. On Admin page: start QR scan → show a QR code to camera
8. Verify: Projector shows QR scan entry

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: pairing mode with NFC/QR scanning between Projector and Admin"
```
