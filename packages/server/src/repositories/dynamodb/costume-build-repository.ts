import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { dynamodb } from "../../services/dynamodb";
import type { CostumeBuild, CostumeBuildRepository, Versioned } from "../types";
import { OptimisticLockError } from "../types";

const TABLE = "CostumeBuilds";

export const createDynamoDBCostumeBuildRepository = (): CostumeBuildRepository => ({
  async findByUserId(userId) {
    const { Items } = await dynamodb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
      }),
    );
    return (Items ?? []) as Versioned<CostumeBuild>[];
  },

  async find(userId, buildId) {
    const { Item } = await dynamodb.send(
      new GetCommand({ TableName: TABLE, Key: { userId, buildId } }),
    );
    return (Item as Versioned<CostumeBuild>) ?? null;
  },

  async create(build) {
    const item: Versioned<CostumeBuild> = { ...build, version: 1 };
    await dynamodb.send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(userId) AND attribute_not_exists(buildId)",
      }),
    );
    return item;
  },

  async update(build) {
    const nextVersion = build.version + 1;
    try {
      await dynamodb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { userId: build.userId, buildId: build.buildId },
          UpdateExpression:
            "SET #name = :name, topId = :topId, bottomId = :bottomId, accessoryId = :accessoryId, hairId = :hairId, isDefault = :isDefault, version = :nextVersion",
          ConditionExpression: "version = :currentVersion",
          ExpressionAttributeNames: { "#name": "name" },
          ExpressionAttributeValues: {
            ":name": build.name,
            ":topId": build.topId ?? null,
            ":bottomId": build.bottomId ?? null,
            ":accessoryId": build.accessoryId ?? null,
            ":hairId": build.hairId ?? null,
            ":isDefault": build.isDefault,
            ":currentVersion": build.version,
            ":nextVersion": nextVersion,
          },
        }),
      );
      return { ...build, version: nextVersion };
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw new OptimisticLockError("CostumeBuild", build.buildId);
      }
      throw err;
    }
  },

  async delete(userId, buildId) {
    await dynamodb.send(new DeleteCommand({ TableName: TABLE, Key: { userId, buildId } }));
  },
});
