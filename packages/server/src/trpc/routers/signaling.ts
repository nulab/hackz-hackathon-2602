import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import {
  createRoomOutputSchema,
  joinRoomInputSchema,
  sendSignalInputSchema,
  closeRoomInputSchema,
} from "@hackz/shared";
import type { SignalingEvent } from "@hackz/shared";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { ee, emitSignalToProjector, emitSignalToAdmin } from "../ee";
import { createRoom, getRoom, markAdminConnected, deleteRoom } from "../rooms";

export const signalingRouter = router({
  createRoom: protectedProcedure.output(createRoomOutputSchema).mutation(({ ctx }) => {
    const room = createRoom(ctx.userId);
    return { roomId: room.roomId };
  }),

  joinRoom: publicProcedure.input(joinRoomInputSchema).mutation(({ input }) => {
    const room = getRoom(input.roomId);
    if (!room) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
    }
    if (!markAdminConnected(input.roomId)) {
      throw new TRPCError({ code: "CONFLICT", message: "Room already has an admin" });
    }
    emitSignalToProjector(input.roomId, { type: "joined" });
    return { success: true };
  }),

  sendSignal: publicProcedure.input(sendSignalInputSchema).mutation(({ input }) => {
    const room = getRoom(input.roomId);
    if (!room) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
    }

    const event: SignalingEvent = {
      type: input.type,
      payload: input.payload,
    } as SignalingEvent;

    if (input.from === "admin") {
      emitSignalToProjector(input.roomId, event);
    } else {
      emitSignalToAdmin(input.roomId, event);
    }
    return { success: true };
  }),

  closeRoom: protectedProcedure.input(closeRoomInputSchema).mutation(({ input }) => {
    const room = getRoom(input.roomId);
    if (!room) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
    }
    emitSignalToAdmin(input.roomId, { type: "closed" });
    deleteRoom(input.roomId);
    return { success: true };
  }),

  onSignalForProjector: protectedProcedure.input(joinRoomInputSchema).subscription(({ input }) =>
    observable<SignalingEvent>((emit) => {
      const key = `signal:${input.roomId}:projector`;
      const handler = (event: SignalingEvent) => emit.next(event);
      ee.on(key, handler);
      return () => {
        ee.off(key, handler);
      };
    }),
  ),

  onSignalForAdmin: publicProcedure.input(joinRoomInputSchema).subscription(({ input }) =>
    observable<SignalingEvent>((emit) => {
      const key = `signal:${input.roomId}:admin`;
      const handler = (event: SignalingEvent) => emit.next(event);
      ee.on(key, handler);
      return () => {
        ee.off(key, handler);
      };
    }),
  ),
});
