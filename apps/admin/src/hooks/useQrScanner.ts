import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export const useQrScanner = (elementId: string) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const callbackRef = useRef<((data: string) => void) | null>(null);

  const startScan = useCallback(
    async (onScan: (data: string) => void) => {
      if (scannerRef.current) {
        return;
      }
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
    if (!scannerRef.current) {
      return;
    }
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
