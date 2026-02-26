import { z } from "zod";

// === Enums ===

export const raritySchema = z.enum(["normal", "rare", "superRare", "ultraRare"]);
export type Rarity = z.infer<typeof raritySchema>;

export const costumeCategorySchema = z.enum(["top", "bottom", "accessory", "hair"]);
export type CostumeCategory = z.infer<typeof costumeCategorySchema>;

export const sessionStatusSchema = z.enum(["waiting", "active", "synthesizing", "completed"]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const rankSchema = z.enum(["S", "A", "B", "C"]);
export type Rank = z.infer<typeof rankSchema>;

// === Domain Models ===

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  token: z.string(),
  photoUrl: z.string().optional(),
  equippedBuildId: z.string().optional(),
  totalScore: z.number().default(0),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const userProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  photoUrl: z.string().optional(),
  equippedBuildId: z.string().optional(),
  totalScore: z.number(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const costumeSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: raritySchema,
  category: costumeCategorySchema,
  imageUrl: z.string(),
  description: z.string(),
});
export type Costume = z.infer<typeof costumeSchema>;

export const gachaResultSchema = z.object({
  costume: costumeSchema,
  isNew: z.boolean(),
});
export type GachaResult = z.infer<typeof gachaResultSchema>;

export const userCostumeSchema = z.object({
  userId: z.string(),
  costumeId: z.string(),
  acquiredAt: z.string(),
  count: z.number().min(1),
});
export type UserCostume = z.infer<typeof userCostumeSchema>;

export const costumeBuildSchema = z.object({
  userId: z.string(),
  buildId: z.string(),
  name: z.string(),
  faceId: z.string().optional(),
  upperId: z.string().optional(),
  lowerId: z.string().optional(),
  shoesId: z.string().optional(),
  isDefault: z.boolean().default(false),
  createdAt: z.string(),
});
export type CostumeBuild = z.infer<typeof costumeBuildSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: sessionStatusSchema,
  buildId: z.string(),
  photoUrl: z.string(),
  progress: z.number(),
  videoUrl: z.string().optional(),
  score: z.number().optional(),
  rank: rankSchema.optional(),
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

export const generateFaceInputSchema = z.object({
  photo: z.string(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const generateFaceOutputSchema = z.object({
  faceImageUrl: z.string(),
});

export const getFaceImageOutputSchema = z.object({
  faceImageUrl: z.string().nullable(),
});

export const equipBuildInputSchema = z.object({
  buildId: z.string().min(1),
});

export const saveBuildInputSchema = z.object({
  faceId: z.string().optional(),
  upperId: z.string().optional(),
  lowerId: z.string().optional(),
  shoesId: z.string().optional(),
});

export const createSessionInputSchema = z.object({
  buildId: z.string().min(1),
});

export const startSynthesisInputSchema = z.object({
  sessionId: z.string().min(1),
});

export const nfcScanInputSchema = z.object({
  nfcId: z.string().min(1),
});

export const registerPairingInputSchema = z.object({
  nfcId: z.string().min(1),
  userId: z.string().min(1),
  token: z.string().uuid(),
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
  category: costumeCategorySchema,
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

// === Room Polling Schemas ===

export const roomChannelSchema = z.enum(["upstream", "downstream", "projector"]);
export type RoomChannel = z.infer<typeof roomChannelSchema>;

export const roomRoleSchema = z.enum(["admin", "projector"]);
export type RoomRole = z.infer<typeof roomRoleSchema>;

export const roomMessageSchema = z.object({
  id: z.number(),
  type: z.string(),
  payload: z.unknown(),
  createdAt: z.number(),
});
export type RoomMessage = z.infer<typeof roomMessageSchema>;

// Room procedure inputs
export const roomJoinInputSchema = z.object({
  roomId: z.string().uuid(),
});

export const roomSendInputSchema = z.object({
  roomId: z.string().uuid(),
  channel: roomChannelSchema,
  message: z.object({
    type: z.string(),
    payload: z.unknown(),
  }),
});

export const roomPollInputSchema = z.object({
  roomId: z.string().uuid(),
  channel: z.string(),
  afterId: z.number().optional(),
});

export const roomHeartbeatInputSchema = z.object({
  roomId: z.string().uuid(),
  role: roomRoleSchema,
});

export const roomDisconnectInputSchema = z.object({
  roomId: z.string().uuid(),
  role: roomRoleSchema,
});

// Room procedure outputs
export const roomCreateOutputSchema = z.object({
  roomId: z.string().uuid(),
});

export const roomPollOutputSchema = z.object({
  messages: z.array(roomMessageSchema),
  lastId: z.number(),
});

export const roomHeartbeatOutputSchema = z.object({
  peerConnected: z.boolean(),
  peerLastSeen: z.number(),
});
