import { router } from "../trpc";
import { authRouter } from "./auth";
import { usersRouter } from "./users";
import { gachaRouter } from "./gacha";
import { costumesRouter } from "./costumes";
import { sessionsRouter } from "./sessions";
import { synthesisRouter } from "./synthesis";
import { roomRouter } from "./room";

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  gacha: gachaRouter,
  costumes: costumesRouter,
  sessions: sessionsRouter,
  synthesis: synthesisRouter,
  room: roomRouter,
});

export type AppRouter = typeof appRouter;
