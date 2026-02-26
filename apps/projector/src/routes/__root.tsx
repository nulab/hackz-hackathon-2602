import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TRPCProvider } from "../lib/trpc-provider";

export const Route = createRootRoute({
  component: () => (
    <TRPCProvider>
      <Outlet />
    </TRPCProvider>
  ),
});
