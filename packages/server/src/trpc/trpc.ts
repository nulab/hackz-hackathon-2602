import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import { createDynamoDBUserRepository } from "../repositories/dynamodb/user-repository";

const t = initTRPC.context<Context>().create();

const userRepository = createDynamoDBUserRepository();

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  if (!ctx.userToken) {
    throw new TRPCError({ code: "FORBIDDEN", message: "User token required" });
  }

  const user = await userRepository.findById(ctx.userId);
  if (!user || user.token !== ctx.userToken) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Invalid user token" });
  }

  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const protectedProcedure = publicProcedure.use(isAuthed);
