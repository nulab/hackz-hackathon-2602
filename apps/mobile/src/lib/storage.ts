export type InventoryItem = {
  count: number;
};

export type InventoryMap = Record<string, InventoryItem>;

const STORAGE_KEYS = {
  PHOTO: "photo",
} as const;

export const storage = {
  getPhoto(): string | null {
    return localStorage.getItem(STORAGE_KEYS.PHOTO);
  },
  savePhoto(dataURL: string): void {
    localStorage.setItem(STORAGE_KEYS.PHOTO, dataURL);
  },
};
