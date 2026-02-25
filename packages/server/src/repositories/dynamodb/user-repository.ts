import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { dynamodb } from "../../services/dynamodb";
import type { User, UserRepository, Versioned } from "../types";
import { OptimisticLockError } from "../types";

const TABLE = "Users";

export const createDynamoDBUserRepository = (): UserRepository => ({
  async findById(id) {
    const { Item } = await dynamodb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
    return (Item as Versioned<User>) ?? null;
  },

  async findByNfcId(nfcId) {
    const { Items } = await dynamodb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "nfcId-index",
        KeyConditionExpression: "nfcId = :nfcId",
        ExpressionAttributeValues: { ":nfcId": nfcId },
        Limit: 1,
      }),
    );
    return (Items?.[0] as Versioned<User>) ?? null;
  },

  async create(user) {
    const item: Versioned<User> = { ...user, version: 1 };
    await dynamodb.send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
    return item;
  },

  async update(user) {
    const nextVersion = user.version + 1;
    try {
      await dynamodb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { id: user.id },
          UpdateExpression:
            "SET #name = :name, photoUrl = :photoUrl, equippedCostumeId = :equippedCostumeId, version = :nextVersion",
          ConditionExpression: "version = :currentVersion",
          ExpressionAttributeNames: { "#name": "name" },
          ExpressionAttributeValues: {
            ":name": user.name,
            ":photoUrl": user.photoUrl ?? null,
            ":equippedCostumeId": user.equippedCostumeId ?? null,
            ":currentVersion": user.version,
            ":nextVersion": nextVersion,
          },
        }),
      );
      return { ...user, version: nextVersion };
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw new OptimisticLockError("User", user.id);
      }
      throw err;
    }
  },
});
