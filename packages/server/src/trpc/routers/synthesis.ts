import { z } from "zod";
import {
  startSynthesisInputSchema,
  sessionStatusSchema,
  synthesisStatusSchema,
} from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";

export const synthesisRouter = router({
  start: protectedProcedure
    .input(startSynthesisInputSchema)
    .output(z.object({ sessionId: z.string(), status: sessionStatusSchema }))
    .mutation(async ({ input }) => ({
      sessionId: input.sessionId,
      status: "synthesizing" as const,
    })),

  status: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .output(synthesisStatusSchema)
    .query(async ({ input }) => ({
      sessionId: input.sessionId,
      status: "synthesizing" as const,
      progress: 0,
    })),
});
