import { useCallback, useEffect, useRef, useState } from "react";

type NfcReadResult = {
  serialNumber: string;
  records: { recordType: string; data: string }[];
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
        try {
          const records = Array.from(event.message.records).map((r) => ({
            recordType: r.recordType,
            data: new TextDecoder().decode(r.data),
          }));
          setLastRead({ serialNumber: event.serialNumber ?? "", records });
        } catch (e) {
          // records のパースに失敗しても serialNumber だけで読み取り結果を返す
          setLastRead({
            serialNumber: event.serialNumber ?? "",
            records: [],
          });
          setError(e instanceof Error ? e.message : "NFC record parse error");
        }
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
