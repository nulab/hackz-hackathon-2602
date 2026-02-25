import { z } from "zod";

// === Enums ===

export const raritySchema = z.enum(["normal", "rare", "superRare", "ultraRare"]);
export type Rarity = z.infer<typeof raritySchema>;

export const sessionStatusSchema = z.enum(["waiting", "active", "synthesizing", "completed"]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

// === Domain Models ===

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  photoUrl: z.string().optional(),
  equippedCostumeId: z.string().optional(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const userProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  photoUrl: z.string().optional(),
  equippedCostumeId: z.string().optional(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const costumeSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: raritySchema,
  imageUrl: z.string(),
  description: z.string(),
});
export type Costume = z.infer<typeof costumeSchema>;

export const gachaResultSchema = z.object({
  costume: costumeSchema,
  isNew: z.boolean(),
});
export type GachaResult = z.infer<typeof gachaResultSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: sessionStatusSchema,
  costumeId: z.string(),
  progress: z.number(),
  videoUrl: z.string().optional(),
  createdAt: z.string(),
});
export type SessionState = z.infer<typeof sessionSchema>;

export const synthesisStatusSchema = z.object({
  sessionId: z.string(),
  status: sessionStatusSchema,
  progress: z.number(),
  videoUrl: z.string().optional(),
});
export type SynthesisStatus = z.infer<typeof synthesisStatusSchema>;

// === Procedure Input Schemas ===

export const nfcLoginInputSchema = z.object({
  nfcId: z.string().min(1),
});

export const photoUploadInputSchema = z.object({
  photo: z.string(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const equipCostumeInputSchema = z.object({
  costumeId: z.string().min(1),
});

export const createSessionInputSchema = z.object({
  costumeId: z.string().min(1),
});

export const startSynthesisInputSchema = z.object({
  sessionId: z.string().min(1),
});

export const nfcScanInputSchema = z.object({
  nfcId: z.string().min(1),
});

// === SSE Event Schemas ===

export const nfcScannedEventSchema = z.object({
  type: z.literal("nfc:scanned"),
  userId: z.string(),
  userName: z.string(),
});

export const gachaResultEventSchema = z.object({
  type: z.literal("gacha:result"),
  userId: z.string(),
  costumeId: z.string(),
  costumeName: z.string(),
  rarity: raritySchema,
});

export const sessionUpdatedEventSchema = z.object({
  type: z.literal("session:updated"),
  sessionId: z.string(),
  status: sessionStatusSchema,
  progress: z.number(),
  videoUrl: z.string().optional(),
});

export const synthesisCompletedEventSchema = z.object({
  type: z.literal("synthesis:completed"),
  sessionId: z.string(),
  videoUrl: z.string(),
});

export const projectorEventSchema = z.union([nfcScannedEventSchema, gachaResultEventSchema]);
export type ProjectorEvent = z.infer<typeof projectorEventSchema>;

export const sessionEventSchema = z.union([
  sessionUpdatedEventSchema,
  synthesisCompletedEventSchema,
]);
export type SessionEvent = z.infer<typeof sessionEventSchema>;
