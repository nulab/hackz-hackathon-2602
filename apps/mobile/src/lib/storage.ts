export type InventoryItem = {
  count: number;
};

export type InventoryMap = Record<string, InventoryItem>;

const STORAGE_KEYS = {
  INVENTORY: "inventoryMap",
  SELECTED_ITEMS: "selectedItemIds",
  PHOTO: "photo",
  FACE_IMAGE_URL: "faceImageUrl",
} as const;

export const storage = {
  getInventory(): InventoryMap {
    const stored = localStorage.getItem(STORAGE_KEYS.INVENTORY);
    return stored ? JSON.parse(stored) : {};
  },
  saveInventory(inventory: InventoryMap): void {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
  },
  getSelectedItems(): string[] {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_ITEMS);
    return stored ? JSON.parse(stored) : [];
  },
  saveSelectedItems(itemIds: string[]): void {
    localStorage.setItem(STORAGE_KEYS.SELECTED_ITEMS, JSON.stringify(itemIds));
  },
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
