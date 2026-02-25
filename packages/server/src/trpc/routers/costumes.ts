import { z } from "zod";
import { equipBuildInputSchema, costumeSchema } from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";
import { createDynamoDBCostumeRepository } from "../../repositories/dynamodb/costume-repository";
import { createDynamoDBUserCostumeRepository } from "../../repositories/dynamodb/user-costume-repository";

const costumeRepo = createDynamoDBCostumeRepository();
const userCostumeRepo = createDynamoDBUserCostumeRepository();

const costumeWithCountSchema = costumeSchema.extend({ count: z.number().min(1) });

export const costumesRouter = router({
  list: protectedProcedure
    .output(z.object({ costumes: z.array(costumeWithCountSchema) }))
    .query(async ({ ctx }) => {
      const userCostumes = await userCostumeRepo.findByUserId(ctx.userId);
      const costumes = await Promise.all(
        userCostumes.map(async (uc) => {
          const costume = await costumeRepo.findById(uc.costumeId);
          if (!costume) {
            return null;
          }
          const { weight: _, version: __, ...rest } = costume;
          return { ...rest, count: uc.count };
        }),
      );
      return { costumes: costumes.filter((c) => c !== null) };
    }),

  equip: protectedProcedure
    .input(equipBuildInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async () => ({ success: true })),
});
