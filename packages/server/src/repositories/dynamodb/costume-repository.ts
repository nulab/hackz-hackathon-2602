import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodb } from "../../services/dynamodb";
import type { Costume, CostumeRepository, Versioned } from "../types";

const TABLE = "Costumes";

export const createDynamoDBCostumeRepository = (): CostumeRepository => ({
  async findById(id) {
    const { Item } = await dynamodb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
    return (Item as Versioned<Costume>) ?? null;
  },

  async findByRarity(rarity) {
    const { Items } = await dynamodb.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "rarity = :rarity",
        ExpressionAttributeValues: { ":rarity": rarity },
      }),
    );
    return (Items ?? []) as Versioned<Costume>[];
  },

  async findAll() {
    const { Items } = await dynamodb.send(new ScanCommand({ TableName: TABLE }));
    return (Items ?? []) as Versioned<Costume>[];
  },

  async create(costume) {
    const item: Versioned<Costume> = { ...costume, version: 1 };
    await dynamodb.send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
    return item;
  },
});
