import { z } from "zod";
import {
  generateFaceInputSchema,
  generateFaceOutputSchema,
  getFaceImageOutputSchema,
  userProfileSchema,
} from "@hackz/shared";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { createDynamoDBUserRepository } from "../../repositories/dynamodb/user-repository";
import { extractBase64FromDataURL, validatePhotoSize } from "../../domain/face-generation";
import { generateFaceIllustration } from "../../services/face-generation";
import { uploadFile } from "../../services/s3";

const userRepository = createDynamoDBUserRepository();

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

export const usersRouter = router({
  me: protectedProcedure.output(userProfileSchema).query(async ({ ctx }) => {
    const user = await userRepository.findById(ctx.userId);
    if (!user) {
      return {
        id: ctx.userId,
        name: `User-${ctx.userId.slice(0, 6)}`,
        totalScore: 0,
      };
    }
    return {
      id: user.id,
      name: user.name,
      photoUrl: user.photoUrl,
      equippedBuildId: user.equippedBuildId,
      totalScore: user.totalScore,
    };
  }),

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

  generateFace: protectedProcedure
    .input(generateFaceInputSchema)
    .output(generateFaceOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { base64, mimeType } = extractBase64FromDataURL(input.photo);

      try {
        validatePhotoSize(base64, MAX_PHOTO_BYTES);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Photo size exceeds 5MB limit",
        });
      }

      // Save original photo for reference
      const photoBuffer = Buffer.from(base64, "base64");
      const ext = mimeType === "image/png" ? "png" : "jpg";
      await uploadFile(`photos/${ctx.userId}.${ext}`, photoBuffer, mimeType);

      // Generate face illustration via Nova Canvas
      const { faceImageUrl } = await generateFaceIllustration(ctx.userId, base64);

      // Update user's photoUrl with optimistic locking
      const user = await userRepository.findById(ctx.userId);
      if (user) {
        await userRepository.update({ ...user, photoUrl: faceImageUrl });
      }

      return { faceImageUrl };
    }),

  getFaceImage: protectedProcedure.output(getFaceImageOutputSchema).query(async ({ ctx }) => {
    const user = await userRepository.findById(ctx.userId);
    return { faceImageUrl: user?.photoUrl ?? null };
  }),
});
