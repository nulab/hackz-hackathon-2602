import { z } from "zod/v4";

// --- Room management ---

export const createRoomOutputSchema = z.object({
  roomId: z.string(),
});

export const joinRoomInputSchema = z.object({
  roomId: z.string(),
});

// --- Signaling messages ---

export const sendSignalInputSchema = z.object({
  roomId: z.string(),
  type: z.enum(["offer", "answer", "ice-candidate"]),
  payload: z.string(),
  from: z.enum(["projector", "admin"]),
});

export const closeRoomInputSchema = z.object({
  roomId: z.string(),
});

// --- SSE events ---

export const signalingEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("joined") }),
  z.object({ type: z.literal("offer"), payload: z.string() }),
  z.object({ type: z.literal("answer"), payload: z.string() }),
  z.object({ type: z.literal("ice-candidate"), payload: z.string() }),
  z.object({ type: z.literal("closed") }),
]);

export type SignalingEvent = z.infer<typeof signalingEventSchema>;
