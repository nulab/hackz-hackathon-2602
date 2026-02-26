import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  equipBuildInputSchema,
  costumeBuildSchema,
  costumeSchema,
  saveBuildInputSchema,
} from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";
import { createDynamoDBCostumeRepository } from "../../repositories/dynamodb/costume-repository";
import { createDynamoDBUserCostumeRepository } from "../../repositories/dynamodb/user-costume-repository";
import { createDynamoDBCostumeBuildRepository } from "../../repositories/dynamodb/costume-build-repository";
import { validateBuildOwnership } from "../../domain/costume-build";

const costumeRepo = createDynamoDBCostumeRepository();
const userCostumeRepo = createDynamoDBUserCostumeRepository();
const costumeBuildRepo = createDynamoDBCostumeBuildRepository();

const DEFAULT_BUILD_ID = "default";

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

  getBuild: protectedProcedure.output(costumeBuildSchema.nullable()).query(async ({ ctx }) => {
    const build = await costumeBuildRepo.find(ctx.userId, DEFAULT_BUILD_ID);
    if (!build) {
      return null;
    }
    const { version: _, ...rest } = build;
    return rest;
  }),

  saveBuild: protectedProcedure
    .input(saveBuildInputSchema)
    .output(costumeBuildSchema)
    .mutation(async ({ ctx, input }) => {
      const userCostumes = await userCostumeRepo.findByUserId(ctx.userId);
      const ownedIds = new Set(userCostumes.map((uc) => uc.costumeId));

      const unowned = validateBuildOwnership(
        [input.faceId, input.upperId, input.lowerId, input.shoesId],
        ownedIds,
      );
      if (unowned.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `未所持のコスチュームが含まれています: ${unowned.join(", ")}`,
        });
      }

      const existing = await costumeBuildRepo.find(ctx.userId, DEFAULT_BUILD_ID);

      if (existing) {
        const updated = await costumeBuildRepo.update({
          ...existing,
          faceId: input.faceId,
          upperId: input.upperId,
          lowerId: input.lowerId,
          shoesId: input.shoesId,
        });
        const { version: _, ...rest } = updated;
        return rest;
      }

      const created = await costumeBuildRepo.create({
        userId: ctx.userId,
        buildId: DEFAULT_BUILD_ID,
        name: "default",
        faceId: input.faceId,
        upperId: input.upperId,
        lowerId: input.lowerId,
        shoesId: input.shoesId,
        isDefault: true,
        createdAt: new Date().toISOString(),
      });
      const { version: _, ...rest } = created;
      return rest;
    }),

  equip: protectedProcedure
    .input(equipBuildInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async () => ({ success: true })),
});
