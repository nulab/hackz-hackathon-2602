import { createFileRoute } from "@tanstack/react-router";
import { ITEMS } from "../../../../lib/items";
import { cardImages, uiImages } from "../../../../assets/images";
import { PrimaryButton } from "../../../../components/PrimaryButton";
import styles from "./$costumeKey.module.css";

const GachaResultPage = () => {
  const { userId, costumeKey } = Route.useParams();
  const item = ITEMS.find((i) => i.id === costumeKey);

  if (!item) {
    return (
      <div className="page container">
        <p>アイテムが見つかりません</p>
        <PrimaryButton href={`/u/${userId}`}>トップにもどる</PrimaryButton>
      </div>
    );
  }

  const cardBackImage = item.rarity === "SSR" ? uiImages.cardBackSsr : uiImages.cardBack;

  return (
    <div className="page container">
      <div className={styles.gachaResult}>
        <div className="card auto-flip mb-md">
          <div className="front">
            <img src={cardImages[item.id]} alt={item.name} />
          </div>
          <div className="back">
            <img src={cardBackImage} alt="カード裏面" />
          </div>
        </div>
      </div>
      <div className={styles.buttonGroup}>
        <PrimaryButton href={`/u/${userId}`}>トップにもどる</PrimaryButton>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/u/$userId/gacha/$costumeKey")({
  component: GachaResultPage,
});
