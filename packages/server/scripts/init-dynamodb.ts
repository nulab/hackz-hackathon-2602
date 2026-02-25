const ENDPOINT = process.env.DYNAMODB_ENDPOINT || "http://localhost:8787";

const dynamoRequest = async (target: string, body: Record<string, unknown>) => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.0",
      "X-Amz-Target": `DynamoDB_20120810.${target}`,
      Authorization:
        "AWS4-HMAC-SHA256 Credential=local/20260101/ap-northeast-1/dynamodb/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=fake",
      "X-Amz-Date": "20260101T000000Z",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DynamoDB ${target} failed (${res.status}): ${text}`);
  }
  return res.json();
};

const tables = [
  {
    TableName: "Users",
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "nfcId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "nfcId-index",
        KeySchema: [{ AttributeName: "nfcId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: "Costumes",
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "rarity", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "rarity-index",
        KeySchema: [{ AttributeName: "rarity", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: "UserCostumes",
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "costumeId", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "costumeId", AttributeType: "S" },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: "CostumeBuilds",
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "buildId", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "buildId", AttributeType: "S" },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: "Sessions",
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "createdAt", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "userId-index",
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" },
          { AttributeName: "createdAt", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
];

type CostumeSeed = {
  id: string;
  name: string;
  rarity: string;
  category: string;
  imageUrl: string;
  description: string;
  weight: number;
  version: number;
};

const costumeSeedData: CostumeSeed[] = [
  // office (weight: 600 each, total 2400, ~60%)
  {
    id: "office-face",
    name: "くろぶちメガネ",
    rarity: "normal",
    category: "accessory",
    imageUrl: "",
    description: "オフィスコーデのメガネ",
    weight: 600,
    version: 1,
  },
  {
    id: "office-upper",
    name: "へそだしTシャツ",
    rarity: "normal",
    category: "top",
    imageUrl: "",
    description: "オフィスコーデのTシャツ",
    weight: 600,
    version: 1,
  },
  {
    id: "office-lower",
    name: "あかいズボン",
    rarity: "normal",
    category: "bottom",
    imageUrl: "",
    description: "オフィスコーデのズボン",
    weight: 600,
    version: 1,
  },
  {
    id: "office-shoes",
    name: "くろいスニーカー",
    rarity: "normal",
    category: "hair",
    imageUrl: "",
    description: "オフィスコーデのスニーカー",
    weight: 600,
    version: 1,
  },
  // princess (weight: 250 each, total 1000, ~25%)
  {
    id: "princess-face",
    name: "はっぱのかんむり",
    rarity: "rare",
    category: "accessory",
    imageUrl: "",
    description: "プリンセスコーデのかんむり",
    weight: 250,
    version: 1,
  },
  {
    id: "princess-upper",
    name: "ドレス（うえ）",
    rarity: "rare",
    category: "top",
    imageUrl: "",
    description: "プリンセスコーデのドレス上",
    weight: 250,
    version: 1,
  },
  {
    id: "princess-lower",
    name: "ドレス（した）",
    rarity: "rare",
    category: "bottom",
    imageUrl: "",
    description: "プリンセスコーデのドレス下",
    weight: 250,
    version: 1,
  },
  {
    id: "princess-shoes",
    name: "ガラスのヒール",
    rarity: "rare",
    category: "hair",
    imageUrl: "",
    description: "プリンセスコーデのヒール",
    weight: 250,
    version: 1,
  },
  // gal (weight: 120 each, total 480, ~12%)
  {
    id: "gal-face",
    name: "ギャルサングラス",
    rarity: "superRare",
    category: "accessory",
    imageUrl: "",
    description: "ギャルコーデのサングラス",
    weight: 120,
    version: 1,
  },
  {
    id: "gal-upper",
    name: "ギャルロンT",
    rarity: "superRare",
    category: "top",
    imageUrl: "",
    description: "ギャルコーデのロンT",
    weight: 120,
    version: 1,
  },
  {
    id: "gal-lower",
    name: "ギャルデニム",
    rarity: "superRare",
    category: "bottom",
    imageUrl: "",
    description: "ギャルコーデのデニム",
    weight: 120,
    version: 1,
  },
  {
    id: "gal-shoes",
    name: "ギャルスニーカー",
    rarity: "superRare",
    category: "hair",
    imageUrl: "",
    description: "ギャルコーデのスニーカー",
    weight: 120,
    version: 1,
  },
  // ssr (weight: 30 each, total 120, ~3%)
  {
    id: "ssr-face",
    name: "すごいヘッドホン",
    rarity: "ultraRare",
    category: "accessory",
    imageUrl: "",
    description: "超レアなヘッドホン",
    weight: 30,
    version: 1,
  },
  {
    id: "ssr-upper",
    name: "すごいトップス",
    rarity: "ultraRare",
    category: "top",
    imageUrl: "",
    description: "超レアなトップス",
    weight: 30,
    version: 1,
  },
  {
    id: "ssr-lower",
    name: "すごいスカート",
    rarity: "ultraRare",
    category: "bottom",
    imageUrl: "",
    description: "超レアなスカート",
    weight: 30,
    version: 1,
  },
  {
    id: "ssr-shoes",
    name: "すごいハイヒール",
    rarity: "ultraRare",
    category: "hair",
    imageUrl: "",
    description: "超レアなハイヒール",
    weight: 30,
    version: 1,
  },
];

const seedCostumes = async () => {
  let seeded = 0;
  for (const costume of costumeSeedData) {
    try {
      await dynamoRequest("PutItem", {
        TableName: "Costumes",
        Item: {
          id: { S: costume.id },
          name: { S: costume.name },
          rarity: { S: costume.rarity },
          category: { S: costume.category },
          imageUrl: { S: costume.imageUrl },
          description: { S: costume.description },
          weight: { N: String(costume.weight) },
          version: { N: String(costume.version) },
        },
        ConditionExpression: "attribute_not_exists(id)",
      });
      seeded++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("ConditionalCheckFailedException")) {
        // Already exists, skip
      } else {
        throw e;
      }
    }
  }
  console.log(`Seeded ${seeded} costumes (${costumeSeedData.length - seeded} already existed)`);
};

const init = async () => {
  const existing = (await dynamoRequest("ListTables", {})) as {
    TableNames: string[];
  };
  const existingNames = existing.TableNames || [];

  for (const table of tables) {
    if (existingNames.includes(table.TableName)) {
      console.log(`Table ${table.TableName} already exists, skipping`);
      continue;
    }
    await dynamoRequest("CreateTable", table);
    console.log(`Created table: ${table.TableName}`);
  }

  await seedCostumes();
  console.log("DynamoDB initialization complete");
};

init().catch(console.error);
