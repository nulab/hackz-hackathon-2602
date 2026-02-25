import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { CameraCapture } from "../../../components/CameraCapture";
import { storage } from "../../../lib/storage";
import { ITEMS } from "../../../lib/items";
import { trpc } from "../../../lib/trpc";
import { DancingModelCanvas } from "../../../components/DancingModelCanvas";
import { uiImages, itemImages } from "../../../assets/images";
import styles from "./index.module.css";

const HomePage = () => {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [_photo, setPhoto] = useState(() => storage.getPhoto());
  const selectedItemIds = storage.getSelectedItems();
  const selectedItems = selectedItemIds
    .map((id) => ITEMS.find((item) => item.id === id))
    .filter((item): item is (typeof ITEMS)[number] => item !== undefined);

  const handleCapture = (dataURL: string) => {
    storage.savePhoto(dataURL);
    setPhoto(dataURL);
    setCameraOpen(false);
  };

  const pullGacha = trpc.gacha.pull.useMutation({
    onSuccess: (result) => {
      navigate({
        to: "/u/$userId/gacha/$costumeKey",
        params: { userId, costumeKey: result.costume.id },
      });
    },
  });

  const handleGacha = () => {
    if (pullGacha.isPending) {
      return;
    }
    pullGacha.mutate();
  };

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.logoContainer}>
        <img src={uiImages.logo} alt="こらぼりずむ" className={styles.logo} />
      </div>

      <div className={styles.characterSection}>
        <div className={styles.characterImage}>
          <DancingModelCanvas />
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

          <PrimaryButton
            onClick={() => setCameraOpen(true)}
            className="button-position button-top-left"
          >
            しゃしんをとろう！
          </PrimaryButton>
          <PrimaryButton
            href={`/u/${userId}/costumes`}
            className="button-position button-right-center"
          >
            コーディネートにちょうせん！
          </PrimaryButton>
          <PrimaryButton onClick={handleGacha} className="button-position button-bottom-left">
            オシャレカードをゲット！
          </PrimaryButton>

          <img src={uiImages.magiccircle} alt="魔法陣" className={styles.magicCircle} />
        </div>
      </div>

      <CameraCapture
        open={cameraOpen}
        onCapture={handleCapture}
        onClose={() => setCameraOpen(false)}
      />
    </div>
  );
};

export const Route = createFileRoute("/u/$userId/")({
  component: HomePage,
});
