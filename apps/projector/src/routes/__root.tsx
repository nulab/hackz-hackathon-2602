import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TRPCProvider } from "../lib/trpc-provider";

export const Route = createRootRoute({
  component: () => (
    <TRPCProvider>
      <div className="min-h-screen bg-black text-white">
        <div className="aspect-video max-h-screen mx-auto">
          <Outlet />
        </div>
      </div>
    </TRPCProvider>
  ),
});
