import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export const createContext = async ({ req }: FetchCreateContextFnOptions) => {
  const userId = req.headers.get("X-User-Id");
  const userToken = req.headers.get("X-User-Token");

  return { userId, userToken };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
