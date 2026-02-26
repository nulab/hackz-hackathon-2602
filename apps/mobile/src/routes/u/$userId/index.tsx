import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { CameraCapture } from "../../../components/CameraCapture";
import { useToast } from "../../../components/Toast";
import { storage } from "../../../lib/storage";
import { ITEMS } from "../../../lib/items";
import { trpc } from "../../../lib/trpc";
import { DancingModelCanvas } from "../../../components/DancingModelCanvas";
import { uiImages, itemImages, cardImages } from "../../../assets/images";
import styles from "./index.module.css";

const prefetchImages = () => {
  const urls = [
    ...Object.values(cardImages),
    ...Object.values(itemImages),
    uiImages.cardBack,
    uiImages.cardBackSsr,
  ];
  for (const url of urls) {
    const img = new Image();
    img.src = url;
  }
};

const HomePage = () => {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [_photo, setPhoto] = useState(() => storage.getPhoto());
  const [faceImageUrl, setFaceImageUrl] = useState(() => storage.getFaceImageUrl());
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: buildData } = trpc.costumes.getBuild.useQuery();

  useEffect(() => {
    prefetchImages();
  }, []);

  const selectedItemIds: string[] = [];
  if (buildData) {
    if (buildData.faceId) {
      selectedItemIds.push(buildData.faceId);
    }
    if (buildData.upperId) {
      selectedItemIds.push(buildData.upperId);
    }
    if (buildData.lowerId) {
      selectedItemIds.push(buildData.lowerId);
    }
    if (buildData.shoesId) {
      selectedItemIds.push(buildData.shoesId);
    }
  }

  const selectedItems = selectedItemIds
    .map((id) => ITEMS.find((item) => item.id === id))
    .filter((item): item is (typeof ITEMS)[number] => item !== undefined);

  const generateFace = trpc.users.generateFace.useMutation({
    onSuccess: (result) => {
      storage.saveFaceImageUrl(result.faceImageUrl);
      setFaceImageUrl(result.faceImageUrl);
      showToast("イラストが完成したよ！", "success");
      setIsGenerating(false);
    },
    onError: () => {
      showToast("イラストの生成に失敗しました…", "error");
      setIsGenerating(false);
    },
  });

  const handleCapture = (dataURL: string) => {
    storage.savePhoto(dataURL);
    setPhoto(dataURL);
    setCameraOpen(false);
    setIsGenerating(true);

    generateFace.mutate({
      photo: dataURL,
      contentType: "image/jpeg",
    });
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
          <DancingModelCanvas faceImageUrl={faceImageUrl} />
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

      <div className={styles.buttonRow}>
        <PrimaryButton onClick={() => setCameraOpen(true)}>しゃしんをとろう！</PrimaryButton>
        <PrimaryButton href={`/u/${userId}/costumes`}>コーディネートにちょうせん！</PrimaryButton>
        <PrimaryButton onClick={handleGacha}>オシャレカードをゲット！</PrimaryButton>
      </div>

      <CameraCapture
        open={cameraOpen}
        onCapture={handleCapture}
        onClose={() => setCameraOpen(false)}
      />

      {isGenerating && (
        <div className={styles.generatingOverlay}>
          <div className={styles.generatingContent}>
            <div className={styles.spinner} />
            <p>イラストを生成中…</p>
          </div>
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/u/$userId/")({
  component: HomePage,
});
