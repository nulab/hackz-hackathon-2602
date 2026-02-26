import { z } from "zod";
import { photoUploadInputSchema, userProfileSchema } from "@hackz/shared";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { createDynamoDBUserRepository } from "../../repositories/dynamodb/user-repository";

const userRepository = createDynamoDBUserRepository();

export const usersRouter = router({
  me: protectedProcedure.output(userProfileSchema).query(async ({ ctx }) => ({
    id: ctx.userId,
    name: `User-${ctx.userId.slice(0, 6)}`,
    totalScore: 0,
  })),

  findByNfc: publicProcedure
    .input(z.object({ nfcId: z.string().min(1) }))
    .query(async ({ input }) => {
      const user = await userRepository.findByNfcId(input.nfcId);
      if (!user) {
        return { found: false as const, user: null };
      }
      return {
        found: true as const,
        user: {
          id: user.id,
          name: user.name,
          photoUrl: user.photoUrl ?? null,
          totalScore: user.totalScore,
        },
      };
    }),

  uploadPhoto: protectedProcedure
    .input(photoUploadInputSchema)
    .output(z.object({ photoUrl: z.string() }))
    .mutation(async () => ({
      photoUrl: "https://placeholder.example.com/photo.jpg",
    })),
});
