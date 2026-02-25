import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  roomJoinInputSchema,
  roomSendInputSchema,
  roomPollInputSchema,
  roomHeartbeatInputSchema,
  roomDisconnectInputSchema,
  roomCreateOutputSchema,
  roomPollOutputSchema,
  roomHeartbeatOutputSchema,
} from "@hackz/shared";
import { publicProcedure, router } from "../trpc";
import { roomStore } from "../../room-store";

export const roomRouter = router({
  create: publicProcedure.output(roomCreateOutputSchema).mutation(() => {
    const roomId = roomStore.createRoom();
    return { roomId };
  }),

  join: publicProcedure
    .input(roomJoinInputSchema)
    .output(z.object({ ok: z.boolean() }))
    .mutation(({ input }) => {
      if (!roomStore.joinRoom(input.roomId)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }
      return { ok: true };
    }),

  send: publicProcedure
    .input(roomSendInputSchema)
    .output(z.object({ messageId: z.number() }))
    .mutation(({ input }) => {
      const messageId = roomStore.send(input.roomId, input.channel, input.message);
      if (messageId === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }
      return { messageId };
    }),

  poll: publicProcedure
    .input(roomPollInputSchema)
    .output(roomPollOutputSchema)
    .query(({ input }) => roomStore.poll(input.roomId, input.channel, input.afterId)),

  heartbeat: publicProcedure
    .input(roomHeartbeatInputSchema)
    .output(roomHeartbeatOutputSchema)
    .mutation(({ input }) => roomStore.heartbeat(input.roomId, input.role)),

  disconnect: publicProcedure
    .input(roomDisconnectInputSchema)
    .output(z.object({ ok: z.boolean() }))
    .mutation(({ input }) => {
      roomStore.disconnect(input.roomId, input.role);
      return { ok: true };
    }),
});
