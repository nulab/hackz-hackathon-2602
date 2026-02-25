import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ItemGrid } from "../../../components/ItemGrid";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { useToast } from "../../../components/Toast";
import { storage } from "../../../lib/storage";
import { ITEMS } from "../../../lib/items";
import type { ItemLayer } from "../../../lib/items";
import { saveSelection } from "../../../lib/api";
import { DancingModelCanvas } from "../../../components/DancingModelCanvas";
import { uiImages, itemImages } from "../../../assets/images";
import styles from "./costumes.module.css";

const CostumesPage = () => {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [inventoryMap] = useState(() => storage.getInventory());
  const [selectedItemIds, setSelectedItemIds] = useState(() => storage.getSelectedItems());
  const photo = storage.getPhoto();

  const selectedItems = selectedItemIds
    .map((id) => ITEMS.find((item) => item.id === id))
    .filter((item): item is (typeof ITEMS)[number] => item !== undefined);

  const handleItemClick = (itemId: string) => {
    const item = ITEMS.find((i) => i.id === itemId);
    if (!item) {
      return;
    }

    setSelectedItemIds((prev) => {
      const index = prev.indexOf(itemId);
      let next: string[];
      if (index > -1) {
        next = prev.filter((id) => id !== itemId);
      } else {
        next = prev.filter((id) => {
          const existing = ITEMS.find((i) => i.id === id);
          return existing?.layer !== item.layer;
        });
        next.push(itemId);
      }
      storage.saveSelectedItems(next);
      return next;
    });
  };

  const handleSave = () => {
    if (selectedItemIds.length === 0) {
      showToast("アイテムを選択してください", "error");
      return;
    }
    saveSelection(selectedItemIds);
    showToast("コーディネートを保存しました！", "success");
    setTimeout(() => navigate({ to: "/u/$userId", params: { userId } }), 1500);
  };

  const layers: { key: ItemLayer; label: string }[] = [
    { key: "face", label: "アクセサリー" },
    { key: "upper", label: "トップス" },
    { key: "lower", label: "ボトムス" },
    { key: "shoes", label: "くつ" },
  ];

  return (
    <div className="page container">
      <Link
        to="/u/$userId"
        params={{ userId }}
        className={styles.homeButton}
        aria-label="トップへもどる"
      >
        &larr;
      </Link>

      <div className={styles.closetInfo}>
        <div className={styles.characterSection}>
          <div className={styles.characterImage}>
            {photo ? (
              <img src={photo} alt="撮影した写真" className={styles.photoPreview} />
            ) : (
              <DancingModelCanvas />
            )}
            {selectedItems.length > 0 && (
              <div className={styles.characterBadges}>
                {selectedItems.map((item) => (
                  <img
                    key={item.id}
                    src={itemImages[item.id]}
                    alt={item.name}
                    className={styles.characterBadge}
                  />
                ))}
              </div>
            )}
            {selectedItems.length > 0 && (
              <div className={styles.characterCaption}>
                {selectedItems.map((item) => item.name).join(" / ")}
              </div>
            )}
            <img src={uiImages.magiccircle} alt="魔法陣" className={styles.magicCircle} />
          </div>
        </div>
      </div>

      <div className={styles.layerStatus}>
        {layers.map(({ key, label }) => {
          const selected = selectedItemIds.find((id) => {
            const item = ITEMS.find((i) => i.id === id);
            return item?.layer === key;
          });
          const selectedItem = selected ? ITEMS.find((i) => i.id === selected) : null;
          return (
            <div key={key} className={styles.layerStatusItem}>
              <span className={styles.layerLabel}>{label}</span>
              <span
                className={`${styles.layerSelected} ${selectedItem ? styles.hasSelection : ""}`}
              >
                {selectedItem?.name ?? "未選択"}
              </span>
            </div>
          );
        })}
      </div>

      <ItemGrid
        inventoryMap={inventoryMap}
        selectedItemIds={selectedItemIds}
        onItemClick={handleItemClick}
      />

      <div className={styles.buttonGroup}>
        <PrimaryButton onClick={handleSave}>このコーディネートにする！</PrimaryButton>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/u/$userId/costumes")({
  component: CostumesPage,
});
