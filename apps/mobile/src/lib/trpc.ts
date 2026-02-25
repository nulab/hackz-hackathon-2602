import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@hackz/server/trpc";

export const trpc = createTRPCReact<AppRouter>();
