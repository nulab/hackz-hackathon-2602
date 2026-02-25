import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { photoUploadInputSchema, userProfileSchema } from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";
import { createDynamoDBUserRepository } from "../../repositories/dynamodb/user-repository";
import { uploadFile } from "../../services/s3";

const userRepo = createDynamoDBUserRepository();

export const usersRouter = router({
  me: protectedProcedure.output(userProfileSchema).query(async ({ ctx }) => {
    const user = await userRepo.findById(ctx.userId);
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    return {
      id: user.id,
      name: user.name,
      photoUrl: user.photoUrl,
      equippedBuildId: user.equippedBuildId,
      totalScore: user.totalScore,
    };
  }),

  uploadPhoto: protectedProcedure
    .input(photoUploadInputSchema)
    .output(z.object({ photoUrl: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await userRepo.findById(ctx.userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const ext = input.contentType.split("/")[1];
      const key = `photos/${ctx.userId}.${ext}`;
      const buffer = Buffer.from(input.photo, "base64");
      const photoUrl = await uploadFile(key, buffer, input.contentType);

      await userRepo.update({ ...user, photoUrl });

      return { photoUrl };
    }),
});
