import { gachaResultSchema } from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";
import { emitProjectorEvent } from "../ee";
import { pullGacha } from "../../domain/gacha";

export const gachaRouter = router({
  pull: protectedProcedure.output(gachaResultSchema).mutation(async ({ ctx }) => {
    const { rarity } = pullGacha();

    // TODO: Fetch actual costume from DynamoDB based on rarity
    const costume = {
      id: `costume-${Date.now()}`,
      name: `Costume (${rarity})`,
      rarity,
      category: "top" as const,
      imageUrl: "https://placeholder.example.com/costume.jpg",
      description: "A beautiful costume",
    };

    // Broadcast to projector subscribers
    emitProjectorEvent({
      type: "gacha:result",
      userId: ctx.userId,
      costumeId: costume.id,
      costumeName: costume.name,
      rarity: costume.rarity,
      category: costume.category,
    });

    return { costume, isNew: true };
  }),
});
