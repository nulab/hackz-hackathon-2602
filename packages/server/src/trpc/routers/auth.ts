import { z } from "zod";
import { nfcLoginInputSchema, userSchema } from "@hackz/shared";
import { publicProcedure, router } from "../trpc";
import { signToken } from "../../lib/jwt";
import { createDynamoDBUserRepository } from "../../repositories/dynamodb/user-repository";

const userRepository = createDynamoDBUserRepository();

export const authRouter = router({
  nfcLogin: publicProcedure
    .input(nfcLoginInputSchema)
    .output(z.object({ token: z.string(), user: userSchema }))
    .mutation(async ({ input }) => {
      const { nfcId } = input;

      // Look up existing user by NFC ID
      let user = await userRepository.findByNfcId(nfcId);

      if (!user) {
        // Create new user with UUID token
        const userId = crypto.randomUUID();
        user = await userRepository.create({
          id: userId,
          nfcId,
          name: `User-${userId.slice(0, 6)}`,
          token: crypto.randomUUID(),
          totalScore: 0,
          createdAt: new Date().toISOString(),
        });
      }

      const jwtToken = await signToken(user.id);

      return {
        token: jwtToken,
        user: {
          id: user.id,
          name: user.name,
          token: user.token,
          photoUrl: user.photoUrl,
          equippedBuildId: user.equippedBuildId,
          totalScore: user.totalScore,
          createdAt: user.createdAt,
        },
      };
    }),
});
