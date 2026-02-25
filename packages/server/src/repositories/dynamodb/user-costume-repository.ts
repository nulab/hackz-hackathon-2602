import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodb } from "../../services/dynamodb";
import type { UserCostume, UserCostumeRepository } from "../types";

const TABLE = "UserCostumes";

export const createDynamoDBUserCostumeRepository = (): UserCostumeRepository => ({
  async findByUserId(userId) {
    const { Items } = await dynamodb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
      }),
    );
    return (Items ?? []) as UserCostume[];
  },

  async find(userId, costumeId) {
    const { Item } = await dynamodb.send(
      new GetCommand({ TableName: TABLE, Key: { userId, costumeId } }),
    );
    return (Item as UserCostume) ?? null;
  },

  async acquire(userId, costumeId) {
    const existing = await this.find(userId, costumeId);

    if (existing) {
      await dynamodb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { userId, costumeId },
          UpdateExpression: "SET #count = #count + :inc",
          ExpressionAttributeNames: { "#count": "count" },
          ExpressionAttributeValues: { ":inc": 1 },
        }),
      );
      return { item: { ...existing, count: existing.count + 1 }, isNew: false };
    }

    const item: UserCostume = {
      userId,
      costumeId,
      acquiredAt: new Date().toISOString(),
      count: 1,
    };
    await dynamodb.send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(userId) AND attribute_not_exists(costumeId)",
      }),
    );
    return { item, isNew: true };
  },
});
