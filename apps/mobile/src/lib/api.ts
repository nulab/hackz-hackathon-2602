import { ITEMS } from "./items";
import type { Item } from "./items";
import { storage } from "./storage";
import type { InventoryMap } from "./storage";

export function drawGacha(): Item {
  const randomIndex = Math.floor(Math.random() * ITEMS.length);
  return ITEMS[randomIndex];
}

export function getInventory(): InventoryMap {
  return storage.getInventory();
}

export function addToInventory(itemId: string): void {
  const inventory = storage.getInventory();
  if (inventory[itemId]) {
    inventory[itemId].count += 1;
  } else {
    inventory[itemId] = { count: 1 };
  }
  storage.saveInventory(inventory);
}

export function saveSelection(itemIds: string[]): void {
  storage.saveSelectedItems(itemIds);
}

export function getSelectedItems(): Item[] {
  const selectedIds = storage.getSelectedItems();
  return selectedIds
    .map((id) => ITEMS.find((item) => item.id === id))
    .filter((item): item is Item => item !== undefined);
}
