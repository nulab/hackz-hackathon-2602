import { ITEMS } from "../lib/items";
import { ItemTile } from "./ItemTile";
import type { InventoryMap } from "../lib/storage";
import styles from "./ItemGrid.module.css";

type Props = {
  inventoryMap: InventoryMap;
  selectedItemIds: string[];
  onItemClick: (itemId: string) => void;
};

export const ItemGrid = ({ inventoryMap, selectedItemIds, onItemClick }: Props) => (
  <div className={styles.itemGrid}>
    {ITEMS.map((item) => {
      const count = inventoryMap[item.id]?.count ?? 0;
      return (
        <ItemTile
          key={item.id}
          itemId={item.id}
          itemNo={item.no}
          itemName={item.name}
          owned={count > 0}
          count={count}
          selected={selectedItemIds.includes(item.id)}
          onClick={() => onItemClick(item.id)}
        />
      );
    })}
  </div>
);
