import { gachaResultSchema } from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";
import { roomStore } from "../../room-store";
import { selectCostume } from "../../domain/gacha";
import { createDynamoDBCostumeRepository } from "../../repositories/dynamodb/costume-repository";
import { createDynamoDBUserCostumeRepository } from "../../repositories/dynamodb/user-costume-repository";

const costumeRepo = createDynamoDBCostumeRepository();
const userCostumeRepo = createDynamoDBUserCostumeRepository();

export const gachaRouter = router({
  pull: protectedProcedure.output(gachaResultSchema).mutation(async ({ ctx }) => {
    const allCostumes = await costumeRepo.findAll();
    const selected = selectCostume(allCostumes);
    const { isNew } = await userCostumeRepo.acquire(ctx.userId, selected.id);

    const { weight: _, version: __, ...costume } = selected;

    roomStore.broadcast("projector", {
      type: "gacha:result",
      payload: {
        userId: ctx.userId,
        costumeId: costume.id,
        costumeName: costume.name,
        rarity: costume.rarity,
        category: costume.category,
      },
    });

    return { costume, isNew };
  }),
});
