/**
 * Costumes テーブルにシードデータを投入する。
 * 既に存在するアイテムはスキップする（冪等）。
 *
 * Usage:
 *   bun run packages/server/scripts/seed-costumes.ts
 *
 * 環境変数:
 *   AWS_REGION           — DynamoDB リージョン (default: ap-northeast-1)
 *   DYNAMODB_ENDPOINT    — ローカル開発用エンドポイント (省略時は本番)
 */
import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-northeast-1",
  ...(process.env.DYNAMODB_ENDPOINT && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
    },
  }),
});

const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE = "Costumes";

const costumes = [
  // office (weight: 600 each, ~60%)
  {
    id: "office-face",
    name: "くろぶちメガネ",
    rarity: "normal",
    category: "accessory",
    imageUrl: "",
    description: "オフィスコーデのメガネ",
    weight: 600,
  },
  {
    id: "office-upper",
    name: "へそだしTシャツ",
    rarity: "normal",
    category: "top",
    imageUrl: "",
    description: "オフィスコーデのTシャツ",
    weight: 600,
  },
  {
    id: "office-lower",
    name: "あかいズボン",
    rarity: "normal",
    category: "bottom",
    imageUrl: "",
    description: "オフィスコーデのズボン",
    weight: 600,
  },
  {
    id: "office-shoes",
    name: "くろいスニーカー",
    rarity: "normal",
    category: "hair",
    imageUrl: "",
    description: "オフィスコーデのスニーカー",
    weight: 600,
  },
  // princess (weight: 250 each, ~25%)
  {
    id: "princess-face",
    name: "はっぱのかんむり",
    rarity: "rare",
    category: "accessory",
    imageUrl: "",
    description: "プリンセスコーデのかんむり",
    weight: 250,
  },
  {
    id: "princess-upper",
    name: "ドレス（うえ）",
    rarity: "rare",
    category: "top",
    imageUrl: "",
    description: "プリンセスコーデのドレス上",
    weight: 250,
  },
  {
    id: "princess-lower",
    name: "ドレス（した）",
    rarity: "rare",
    category: "bottom",
    imageUrl: "",
    description: "プリンセスコーデのドレス下",
    weight: 250,
  },
  {
    id: "princess-shoes",
    name: "ガラスのヒール",
    rarity: "rare",
    category: "hair",
    imageUrl: "",
    description: "プリンセスコーデのヒール",
    weight: 250,
  },
  // gal (weight: 120 each, ~12%)
  {
    id: "gal-face",
    name: "ギャルサングラス",
    rarity: "superRare",
    category: "accessory",
    imageUrl: "",
    description: "ギャルコーデのサングラス",
    weight: 120,
  },
  {
    id: "gal-upper",
    name: "ギャルロンT",
    rarity: "superRare",
    category: "top",
    imageUrl: "",
    description: "ギャルコーデのロンT",
    weight: 120,
  },
  {
    id: "gal-lower",
    name: "ギャルデニム",
    rarity: "superRare",
    category: "bottom",
    imageUrl: "",
    description: "ギャルコーデのデニム",
    weight: 120,
  },
  {
    id: "gal-shoes",
    name: "ギャルスニーカー",
    rarity: "superRare",
    category: "hair",
    imageUrl: "",
    description: "ギャルコーデのスニーカー",
    weight: 120,
  },
  // ssr (weight: 30 each, ~3%)
  {
    id: "ssr-face",
    name: "すごいヘッドホン",
    rarity: "ultraRare",
    category: "accessory",
    imageUrl: "",
    description: "超レアなヘッドホン",
    weight: 30,
  },
  {
    id: "ssr-upper",
    name: "すごいトップス",
    rarity: "ultraRare",
    category: "top",
    imageUrl: "",
    description: "超レアなトップス",
    weight: 30,
  },
  {
    id: "ssr-lower",
    name: "すごいスカート",
    rarity: "ultraRare",
    category: "bottom",
    imageUrl: "",
    description: "超レアなスカート",
    weight: 30,
  },
  {
    id: "ssr-shoes",
    name: "すごいハイヒール",
    rarity: "ultraRare",
    category: "hair",
    imageUrl: "",
    description: "超レアなハイヒール",
    weight: 30,
  },
];

const seed = async () => {
  let created = 0;
  let skipped = 0;

  for (const costume of costumes) {
    try {
      await dynamodb.send(
        new PutCommand({
          TableName: TABLE,
          Item: { ...costume, version: 1 },
          ConditionExpression: "attribute_not_exists(id)",
        }),
      );
      created++;
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) {
        skipped++;
      } else {
        throw e;
      }
    }
  }

  console.log(`Seed complete: ${created} created, ${skipped} already existed`);
};

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
