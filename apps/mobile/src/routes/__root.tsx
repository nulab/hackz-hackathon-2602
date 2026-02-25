import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TRPCProvider } from "../lib/trpc-provider";

export const Route = createRootRoute({
  component: () => (
    <TRPCProvider>
      <div className="min-h-screen bg-gray-50">
        <Outlet />
      </div>
    </TRPCProvider>
  ),
});
