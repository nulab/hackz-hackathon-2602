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
    TableName: "Sessions",
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "userId-index",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: "Costumes",
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
];

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

  console.log("DynamoDB initialization complete");
};

init().catch(console.error);
