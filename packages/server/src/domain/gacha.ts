import { GACHA_RATES } from "@hackz/shared";

export type GachaRarity = keyof typeof GACHA_RATES;

export type GachaResult = {
  rarity: GachaRarity;
};

/**
 * 重み付きランダムでガチャのレアリティを決定する。
 * ルートハンドラやインフラに依存しない純粋関数。
 * @param random 0〜1 の乱数（テスト時に注入可能）
 */
export const pullGacha = (random: number = Math.random()): GachaResult => {
  let cumulative = 0;

  for (const [rarity, rate] of Object.entries(GACHA_RATES)) {
    cumulative += rate;
    if (random <= cumulative) {
      return { rarity: rarity as GachaRarity };
    }
  }

  // 浮動小数点の丸め誤差対策: ここに到達した場合は最後のレアリティを返す
  const rarities = Object.keys(GACHA_RATES) as GachaRarity[];
  return { rarity: rarities[rarities.length - 1] };
};
