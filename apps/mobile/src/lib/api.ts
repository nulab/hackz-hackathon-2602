import { ITEMS } from "./items";
import type { Item } from "./items";
import { storage } from "./storage";

export const saveSelection = (itemIds: string[]): void => {
  storage.saveSelectedItems(itemIds);
};

export const getSelectedItems = (): Item[] => {
  const selectedIds = storage.getSelectedItems();
  return selectedIds
    .map((id) => ITEMS.find((item) => item.id === id))
    .filter((item): item is Item => item !== undefined);
};
