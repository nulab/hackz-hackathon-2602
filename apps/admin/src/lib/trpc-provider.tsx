import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, splitLink, unstable_httpSubscriptionLink } from "@trpc/client";
import { trpc } from "./trpc";

const API_URL = "http://localhost:3000/trpc";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const TRPCProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        splitLink({
          condition: (op) => op.type === "subscription",
          true: unstable_httpSubscriptionLink({
            url: API_URL,
          }),
          false: httpBatchLink({
            url: API_URL,
            headers: getAuthHeaders,
          }),
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
};
