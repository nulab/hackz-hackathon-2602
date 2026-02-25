import { useState } from "react";
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from "@tanstack/react-query";
import { TRPCClientError, httpBatchLink } from "@trpc/client";
import { trpc } from "./trpc";
import { emitAuthError } from "./auth-error";

const API_URL = import.meta.env.VITE_API_URL || "/trpc";

const getAuthHeaders = () => {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const userToken = localStorage.getItem("userToken");
  if (userToken) {
    headers["X-User-Token"] = userToken;
  }
  return headers;
};

const isUnauthorizedError = (error: unknown): boolean =>
  error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED";

export const TRPCProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (isUnauthorizedError(error)) {
              emitAuthError();
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (isUnauthorizedError(error)) {
              emitAuthError();
            }
          },
        }),
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: API_URL,
          headers: getAuthHeaders,
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
