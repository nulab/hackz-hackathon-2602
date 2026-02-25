import { z } from "zod";
import { createSessionInputSchema, sessionSchema } from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";

export const sessionsRouter = router({
  create: protectedProcedure
    .input(createSessionInputSchema)
    .output(sessionSchema)
    .mutation(async ({ ctx, input }) => ({
      id: `session-${Date.now()}`,
      userId: ctx.userId,
      status: "waiting" as const,
      costumeId: input.costumeId,
      progress: 0,
      createdAt: new Date().toISOString(),
    })),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(sessionSchema)
    .query(async ({ ctx, input }) => ({
      id: input.id,
      userId: ctx.userId,
      status: "waiting" as const,
      costumeId: "",
      progress: 0,
      createdAt: new Date().toISOString(),
    })),
});
