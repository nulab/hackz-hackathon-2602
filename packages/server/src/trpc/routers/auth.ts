import { z } from "zod";
import { nfcLoginInputSchema, userSchema } from "@hackz/shared";
import { publicProcedure, router } from "../trpc";
import { signToken } from "../../lib/jwt";

export const authRouter = router({
  nfcLogin: publicProcedure
    .input(nfcLoginInputSchema)
    .output(z.object({ token: z.string(), user: userSchema }))
    .mutation(async ({ input }) => {
      const { nfcId } = input;

      // TODO: Look up or create user by NFC ID in DynamoDB
      const userId = nfcId;
      const token = await signToken(userId);

      return {
        token,
        user: {
          id: userId,
          name: `User-${userId.slice(0, 6)}`,
          createdAt: new Date().toISOString(),
        },
      };
    }),
});
