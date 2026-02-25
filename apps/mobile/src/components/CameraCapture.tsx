import { useRef, useEffect, useCallback } from "react";
import { useToast } from "./Toast";
import styles from "./CameraCapture.module.css";

type Props = {
  open: boolean;
  onCapture: (dataURL: string) => void;
  onClose: () => void;
};

export function CameraCapture({ open, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { showToast } = useToast();

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (cancelled) {
          for (const t of stream.getTracks()) {
            t.stop();
          }
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        showToast("カメラの使用が許可されていません。", "error");
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, showToast, stopCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const dataURL = canvas.toDataURL("image/jpeg", 0.8);
    stopCamera();
    onCapture(dataURL);
  };

  if (!open) {
    return null;
  }

  return (
    <div className={styles.cameraCapture}>
      <video ref={videoRef} className={styles.cameraVideo} autoPlay playsInline />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className={styles.cameraControls}>
        <button type="button" onClick={handleCapture} className={styles.captureButton}>
          撮影
        </button>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className={styles.closeButton}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
