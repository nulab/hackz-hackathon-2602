import { useEffect } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TRPCProvider } from "../lib/trpc-provider";
import { ToastProvider, useToast } from "../components/Toast";
import { FallingItems } from "../components/FallingItems";
import { onAuthError } from "../lib/auth-error";

const AuthErrorHandler = () => {
  const { showToast } = useToast();

  useEffect(
    () =>
      onAuthError(() => {
        showToast("認証エラーが発生しました。再度ログインしてください。", "error", 5000);
      }),
    [showToast],
  );

  return null;
};

export const Route = createRootRoute({
  component: () => (
    <TRPCProvider>
      <ToastProvider>
        <AuthErrorHandler />
        <div style={{ maxWidth: 480, marginInline: "auto", width: "100%", minHeight: "100vh" }}>
          <FallingItems />
          <div style={{ position: "relative", zIndex: 1 }}>
            <Outlet />
          </div>
        </div>
      </ToastProvider>
    </TRPCProvider>
  ),
});
