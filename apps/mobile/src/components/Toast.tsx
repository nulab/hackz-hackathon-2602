import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

type ToastType = "info" | "success" | "error";

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean } | null>(
    null,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 3000) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setToast({ message, type, visible: true });
    timerRef.current = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: false } : null));
      setTimeout(() => setToast(null), 300);
    }, duration);
  }, []);

  return (
    <ToastContext value={{ showToast }}>
      {children}
      {toast && (
        <div className="toast-container">
          <div
            className={`toast toast-${toast.type} ${toast.visible ? "toast-show" : "toast-hide"}`}
          >
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext>
  );
}
