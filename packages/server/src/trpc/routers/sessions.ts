import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createSessionInputSchema, sessionSchema } from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";
import { createDynamoDBSessionRepository } from "../../repositories/dynamodb/session-repository";

const sessionRepo = createDynamoDBSessionRepository();

export const sessionsRouter = router({
  create: protectedProcedure
    .input(createSessionInputSchema)
    .output(sessionSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await sessionRepo.create({
        id: crypto.randomUUID(),
        userId: ctx.userId,
        status: "waiting",
        buildId: input.buildId,
        photoUrl: "",
        progress: 0,
        createdAt: new Date().toISOString(),
      });
      return session;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(sessionSchema)
    .query(async ({ input }) => {
      const session = await sessionRepo.findById(input.id);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      return session;
    }),
});
