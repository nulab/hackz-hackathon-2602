import { TRPCError } from "@trpc/server";
import { gachaResultSchema } from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";
import { emitProjectorEvent } from "../ee";
import { pullGacha } from "../../domain/gacha";
import { createDynamoDBCostumeRepository } from "../../repositories/dynamodb/costume-repository";
import { createDynamoDBUserCostumeRepository } from "../../repositories/dynamodb/user-costume-repository";

const costumeRepo = createDynamoDBCostumeRepository();
const userCostumeRepo = createDynamoDBUserCostumeRepository();

export const gachaRouter = router({
  pull: protectedProcedure.output(gachaResultSchema).mutation(async ({ ctx }) => {
    const { rarity } = pullGacha();

    const costumes = await costumeRepo.findByRarity(rarity);
    if (costumes.length === 0) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `No costumes available for rarity: ${rarity}`,
      });
    }

    const costume = costumes[Math.floor(Math.random() * costumes.length)];
    const { isNew } = await userCostumeRepo.acquire(ctx.userId, costume.id);

    emitProjectorEvent({
      type: "gacha:result",
      userId: ctx.userId,
      costumeId: costume.id,
      costumeName: costume.name,
      rarity: costume.rarity,
      category: costume.category,
    });

    return { costume, isNew };
  }),
});
