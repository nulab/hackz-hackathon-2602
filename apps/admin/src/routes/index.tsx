import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Html5Qrcode } from "html5-qrcode";

const AdminPage = () => {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

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

        // URL パターンを解析してルーティング
        const scanMatch = decodedText.match(/\/scan\/([a-f0-9-]+)/);
        if (scanMatch) {
          navigate({ to: "/scan/$roomId", params: { roomId: scanMatch[1] } });
          return;
        }

        const connectMatch = decodedText.match(/\/connect\/([a-f0-9-]+)/);
        if (connectMatch) {
          navigate({ to: "/connect/$roomId", params: { roomId: connectMatch[1] } });
          return;
        }
      },
      () => {},
    );
  }, [navigate]);

  // クリーンアップ
  useEffect(
    () => () => {
      scannerRef.current?.stop().catch(() => {});
    },
    [],
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
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
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: AdminPage,
});
