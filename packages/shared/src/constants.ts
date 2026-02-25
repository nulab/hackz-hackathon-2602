/** Gacha rarity probabilities (must sum to 1) */
export const GACHA_RATES = {
  normal: 0.6,
  rare: 0.25,
  superRare: 0.12,
  ultraRare: 0.03,
} as const;

/** Session timeout in milliseconds (5 minutes) */
export const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

/** Max photo file size in bytes (5MB) */
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

/** Supported photo MIME types */
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
