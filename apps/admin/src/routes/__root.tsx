import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TRPCProvider } from "../lib/trpc-provider";

export const Route = createRootRoute({
  component: () => (
    <TRPCProvider>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">Admin Console</h1>
        </header>
        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </TRPCProvider>
  ),
});
