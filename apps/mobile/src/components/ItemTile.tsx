import { itemImages } from "../assets/images";

type Props = {
  itemId: string;
  itemNo: number;
  itemName: string;
  owned: boolean;
  count: number;
  selected: boolean;
  onClick?: () => void;
};

export function ItemTile({ itemId, itemNo, itemName, owned, count, selected, onClick }: Props) {
  return (
    <div
      className={`item-tile ${owned ? "owned" : "unowned"} ${selected ? "selected" : ""}`}
      data-item-id={itemId}
      onClick={owned ? onClick : undefined}
    >
      {owned ? (
        <>
          <img src={itemImages[itemId]} alt={itemName} className="item-image" />
          <div className="item-name">{itemName}</div>
          {count > 1 && <div className="item-badge">&times;{count}</div>}
        </>
      ) : (
        <div className="item-placeholder">No.{String(itemNo).padStart(2, "0")}</div>
      )}
    </div>
  );
}
