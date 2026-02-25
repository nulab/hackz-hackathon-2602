import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { verifyToken } from "../lib/jwt";

export const createContext = async ({ req }: FetchCreateContextFnOptions) => {
  const authorization = req.headers.get("Authorization");
  let userId: string | null = null;

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7);
    const payload = await verifyToken(token);
    userId = payload?.sub ?? null;
  }

  return { userId };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
