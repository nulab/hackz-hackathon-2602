import { z } from "zod";
import { nfcLoginInputSchema, userSchema } from "@hackz/shared";
import { publicProcedure, router } from "../trpc";
import { signToken } from "../../lib/jwt";
import { createDynamoDBUserRepository } from "../../repositories/dynamodb/user-repository";

const userRepo = createDynamoDBUserRepository();

export const authRouter = router({
  nfcLogin: publicProcedure
    .input(nfcLoginInputSchema)
    .output(z.object({ token: z.string(), user: userSchema }))
    .mutation(async ({ input }) => {
      const { nfcId } = input;

      let user = await userRepo.findByNfcId(nfcId);
      if (!user) {
        user = await userRepo.create({
          id: crypto.randomUUID(),
          nfcId,
          name: `User-${nfcId.slice(0, 6)}`,
          totalScore: 0,
          createdAt: new Date().toISOString(),
        });
      }

      const token = await signToken(user.id);

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          photoUrl: user.photoUrl,
          equippedBuildId: user.equippedBuildId,
          totalScore: user.totalScore,
          createdAt: user.createdAt,
        },
      };
    }),
});
