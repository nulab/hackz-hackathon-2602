import { router } from "../trpc";
import { authRouter } from "./auth";
import { usersRouter } from "./users";
import { gachaRouter } from "./gacha";
import { costumesRouter } from "./costumes";
import { sessionsRouter } from "./sessions";
import { synthesisRouter } from "./synthesis";
import { roomRouter } from "./room";
import { projectorViewerRouter } from "./projector-viewer";

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  gacha: gachaRouter,
  costumes: costumesRouter,
  sessions: sessionsRouter,
  synthesis: synthesisRouter,
  room: roomRouter,
  projectorViewer: projectorViewerRouter,
});

export type AppRouter = typeof appRouter;
