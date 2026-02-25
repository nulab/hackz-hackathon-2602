export type ItemRarity = "R" | "SSR";
export type ItemLayer = "face" | "upper" | "lower" | "shoes";

export type Item = {
  id: string;
  no: number;
  name: string;
  rarity: ItemRarity;
  layer: ItemLayer;
};

export const ITEMS: Item[] = [
  { id: "office-face", no: 1, name: "くろぶちメガネ", rarity: "R", layer: "face" },
  { id: "office-upper", no: 2, name: "へそだしTシャツ", rarity: "R", layer: "upper" },
  { id: "office-lower", no: 3, name: "あかいズボン", rarity: "R", layer: "lower" },
  { id: "office-shoes", no: 4, name: "くろいスニーカー", rarity: "R", layer: "shoes" },
  { id: "princess-face", no: 5, name: "はっぱのかんむり", rarity: "R", layer: "face" },
  { id: "princess-upper", no: 6, name: "ドレス（うえ）", rarity: "R", layer: "upper" },
  { id: "princess-lower", no: 7, name: "ドレス（した）", rarity: "R", layer: "lower" },
  { id: "princess-shoes", no: 8, name: "ガラスのヒール", rarity: "R", layer: "shoes" },
  { id: "gal-face", no: 9, name: "ギャルサングラス", rarity: "R", layer: "face" },
  { id: "gal-upper", no: 10, name: "ギャルロンT", rarity: "R", layer: "upper" },
  { id: "gal-lower", no: 11, name: "ギャルデニム", rarity: "R", layer: "lower" },
  { id: "gal-shoes", no: 12, name: "ギャルスニーカー", rarity: "R", layer: "shoes" },
  { id: "ssr-face", no: 13, name: "すごいヘッドホン", rarity: "SSR", layer: "face" },
  { id: "ssr-upper", no: 14, name: "すごいトップス", rarity: "SSR", layer: "upper" },
  { id: "ssr-lower", no: 15, name: "すごいスカート", rarity: "SSR", layer: "lower" },
  { id: "ssr-shoes", no: 16, name: "すごいハイヒール", rarity: "SSR", layer: "shoes" },
];
