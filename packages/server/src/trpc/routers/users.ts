import { z } from "zod";
import { photoUploadInputSchema, userProfileSchema } from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";

export const usersRouter = router({
  me: protectedProcedure.output(userProfileSchema).query(async ({ ctx }) => ({
    id: ctx.userId,
    name: `User-${ctx.userId.slice(0, 6)}`,
    totalScore: 0,
  })),

  uploadPhoto: protectedProcedure
    .input(photoUploadInputSchema)
    .output(z.object({ photoUrl: z.string() }))
    .mutation(async () => ({
      photoUrl: "https://placeholder.example.com/photo.jpg",
    })),
});
