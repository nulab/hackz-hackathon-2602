import { z } from "zod/v4";

// --- Upstream: Admin → Projector ---

export const nfcScannedMessage = z.object({
  type: z.literal("NFC_SCANNED"),
  nfcId: z.string(),
});

export const qrScannedMessage = z.object({
  type: z.literal("QR_SCANNED"),
  data: z.string(),
});

export const pongMessage = z.object({
  type: z.literal("PONG"),
});

export const upstreamMessageSchema = z.discriminatedUnion("type", [
  nfcScannedMessage,
  qrScannedMessage,
  pongMessage,
]);

export type UpstreamMessage = z.infer<typeof upstreamMessageSchema>;

// --- Downstream: Projector → Admin ---

export const scanResultMessage = z.object({
  type: z.literal("SCAN_RESULT"),
  success: z.boolean(),
  scanType: z.enum(["nfc", "qr"]),
  message: z.string().optional(),
});

export const pingMessage = z.object({
  type: z.literal("PING"),
});

export const disconnectMessage = z.object({
  type: z.literal("DISCONNECT"),
  reason: z.string(),
});

export const downstreamMessageSchema = z.discriminatedUnion("type", [
  scanResultMessage,
  pingMessage,
  disconnectMessage,
]);

export type DownstreamMessage = z.infer<typeof downstreamMessageSchema>;

// --- Serialization helpers ---

export const serializeMessage = (msg: UpstreamMessage | DownstreamMessage): string =>
  JSON.stringify(msg);

export const parseUpstreamMessage = (raw: string): UpstreamMessage =>
  upstreamMessageSchema.parse(JSON.parse(raw));

export const parseDownstreamMessage = (raw: string): DownstreamMessage =>
  downstreamMessageSchema.parse(JSON.parse(raw));
