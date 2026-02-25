import { z } from "zod";
import { observable } from "@trpc/server/observable";
import { nfcScanInputSchema } from "@hackz/shared";
import type { ProjectorEvent, SessionEvent } from "@hackz/shared";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { ee, emitProjectorEvent } from "../ee";

export const subscriptionRouter = router({
  // Projector room: NFC scans + gacha results
  onProjector: publicProcedure.subscription(() =>
    observable<ProjectorEvent>((emit) => {
      const handler = (event: ProjectorEvent) => emit.next(event);
      ee.on("projector", handler);
      return () => {
        ee.off("projector", handler);
      };
    }),
  ),

  // Session-specific: session updates + synthesis completion
  onSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .subscription(({ input }) =>
      observable<SessionEvent>((emit) => {
        const key = `session:${input.sessionId}`;
        const handler = (event: SessionEvent) => emit.next(event);
        ee.on(key, handler);
        return () => {
          ee.off(key, handler);
        };
      }),
    ),

  // Admin action: report NFC scan (replaces Socket.IO "nfc:scan" client event)
  nfcScan: protectedProcedure
    .input(nfcScanInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(({ input }) => {
      emitProjectorEvent({
        type: "nfc:scanned",
        userId: input.nfcId,
        userName: `User-${input.nfcId.slice(0, 6)}`,
      });
      return { success: true };
    }),
});
