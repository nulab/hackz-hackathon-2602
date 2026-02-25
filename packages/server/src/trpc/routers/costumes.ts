import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { equipBuildInputSchema, costumeSchema } from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";
import { createDynamoDBCostumeRepository } from "../../repositories/dynamodb/costume-repository";
import { createDynamoDBUserCostumeRepository } from "../../repositories/dynamodb/user-costume-repository";
import { createDynamoDBUserRepository } from "../../repositories/dynamodb/user-repository";

const costumeRepo = createDynamoDBCostumeRepository();
const userCostumeRepo = createDynamoDBUserCostumeRepository();
const userRepo = createDynamoDBUserRepository();

export const costumesRouter = router({
  list: protectedProcedure
    .output(z.object({ costumes: z.array(costumeSchema) }))
    .query(async ({ ctx }) => {
      const userCostumes = await userCostumeRepo.findByUserId(ctx.userId);
      const costumes = await Promise.all(
        userCostumes.map((uc) => costumeRepo.findById(uc.costumeId)),
      );
      return { costumes: costumes.filter((c): c is NonNullable<typeof c> => c !== null) };
    }),

  equip: protectedProcedure
    .input(equipBuildInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const user = await userRepo.findById(ctx.userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      await userRepo.update({ ...user, equippedBuildId: input.buildId });
      return { success: true };
    }),
});
