import { z } from "zod";
import { equipCostumeInputSchema, costumeSchema } from "@hackz/shared";
import { protectedProcedure, router } from "../trpc";

export const costumesRouter = router({
  list: protectedProcedure
    .output(z.object({ costumes: z.array(costumeSchema) }))
    .query(async () => ({ costumes: [] })),

  equip: protectedProcedure
    .input(equipCostumeInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async () => ({ success: true })),
});
