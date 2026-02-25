import { z } from "zod";
import { nfcLoginInputSchema, registerPairingInputSchema, userSchema } from "@hackz/shared";
import { TRPCError } from "@trpc/server";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
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

  registerPairing: publicProcedure
    .input(registerPairingInputSchema)
    .output(z.object({ user: userSchema }))
    .mutation(async ({ input }) => {
      const { nfcId, userId, token } = input;

      // Check if another user already has this NFC ID
      const existingUser = await userRepository.findByNfcId(nfcId);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `NFC ID "${nfcId}" is already registered to another user`,
        });
      }

      try {
        const user = await userRepository.create({
          id: userId,
          nfcId,
          token,
          name: `User-${userId}`,
          totalScore: 0,
          createdAt: new Date().toISOString(),
        });

        return {
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
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `User with ID "${userId}" already exists`,
          });
        }
        throw error;
      }
    }),
});
