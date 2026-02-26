export type InventoryItem = {
  count: number;
};

export type InventoryMap = Record<string, InventoryItem>;

const STORAGE_KEYS = {
  PHOTO: "photo",
  FACE_IMAGE_URL: "faceImageUrl",
} as const;

export const storage = {
  getPhoto(): string | null {
    return localStorage.getItem(STORAGE_KEYS.PHOTO);
  },
  savePhoto(dataURL: string): void {
    localStorage.setItem(STORAGE_KEYS.PHOTO, dataURL);
  },
  getFaceImageUrl(): string | null {
    return localStorage.getItem(STORAGE_KEYS.FACE_IMAGE_URL);
  },
  saveFaceImageUrl(url: string): void {
    localStorage.setItem(STORAGE_KEYS.FACE_IMAGE_URL, url);
  },
};
