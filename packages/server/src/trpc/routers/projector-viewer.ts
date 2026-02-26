import { z } from "zod";
import { activeUserOutputSchema, setActiveUserInputSchema } from "@hackz/shared";
import { publicProcedure, router } from "../trpc";
import { activeUserStore } from "../../active-user-store";
import { createDynamoDBUserRepository } from "../../repositories/dynamodb/user-repository";
import { createDynamoDBCostumeBuildRepository } from "../../repositories/dynamodb/costume-build-repository";

const userRepo = createDynamoDBUserRepository();
const buildRepo = createDynamoDBCostumeBuildRepository();

export const projectorViewerRouter = router({
  getActiveUser: publicProcedure.output(activeUserOutputSchema).query(async () => {
    const active = activeUserStore.get();
    if (!active) {
      return { user: null, build: null, cleared: activeUserStore.isCleared() };
    }

    const user = await userRepo.findById(active.userId);
    if (!user) {
      return { user: null, build: null, cleared: false };
    }

    const build = await buildRepo.find(active.userId, "default");

    return {
      user: {
        id: user.id,
        name: user.name,
        photoUrl: user.photoUrl,
      },
      build: build
        ? {
            faceId: build.faceId,
            upperId: build.upperId,
            lowerId: build.lowerId,
            shoesId: build.shoesId,
          }
        : null,
      cleared: false,
    };
  }),

  setActiveUser: publicProcedure
    .input(setActiveUserInputSchema)
    .output(z.object({ success: z.boolean(), userId: z.string().nullable() }))
    .mutation(async ({ input }) => {
      const user = await userRepo.findByNfcId(input.nfcId);
      if (!user) {
        return { success: false, userId: null };
      }
      activeUserStore.set(user.id, input.nfcId);
      return { success: true, userId: user.id };
    }),

  clearActiveUser: publicProcedure.output(z.object({ success: z.boolean() })).mutation(() => {
    activeUserStore.clear();
    return { success: true };
  }),
});
