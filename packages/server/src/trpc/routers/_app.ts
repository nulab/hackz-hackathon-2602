import { router } from "../trpc";
import { authRouter } from "./auth";
import { usersRouter } from "./users";
import { gachaRouter } from "./gacha";
import { costumesRouter } from "./costumes";
import { sessionsRouter } from "./sessions";
import { synthesisRouter } from "./synthesis";
import { subscriptionRouter } from "./subscriptions";

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  gacha: gachaRouter,
  costumes: costumesRouter,
  sessions: sessionsRouter,
  synthesis: synthesisRouter,
  sub: subscriptionRouter,
});

export type AppRouter = typeof appRouter;
