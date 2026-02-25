import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TRPCProvider } from "../lib/trpc-provider";
import { ToastProvider } from "../components/Toast";
import { FallingItems } from "../components/FallingItems";

export const Route = createRootRoute({
  component: () => (
    <TRPCProvider>
      <ToastProvider>
        <FallingItems />
        <div style={{ position: "relative", zIndex: 1 }}>
          <Outlet />
        </div>
      </ToastProvider>
    </TRPCProvider>
  ),
});
