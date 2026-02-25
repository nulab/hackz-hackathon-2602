import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  startSynthesisInputSchema,
  sessionStatusSchema,
  synthesisStatusSchema,
} from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";
import { createDynamoDBSessionRepository } from "../../repositories/dynamodb/session-repository";

const sessionRepo = createDynamoDBSessionRepository();

export const synthesisRouter = router({
  start: protectedProcedure
    .input(startSynthesisInputSchema)
    .output(z.object({ sessionId: z.string(), status: sessionStatusSchema }))
    .mutation(async ({ input }) => {
      const session = await sessionRepo.findById(input.sessionId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      const updated = await sessionRepo.update({ ...session, status: "synthesizing", progress: 0 });
      return { sessionId: updated.id, status: updated.status };
    }),

  status: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .output(synthesisStatusSchema)
    .query(async ({ input }) => {
      const session = await sessionRepo.findById(input.sessionId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      return {
        sessionId: session.id,
        status: session.status,
        progress: session.progress,
        videoUrl: session.videoUrl,
      };
    }),
});
