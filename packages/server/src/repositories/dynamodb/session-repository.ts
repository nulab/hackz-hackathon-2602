import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { dynamodb } from "../../services/dynamodb";
import type { Session, SessionRepository, Versioned } from "../types";
import { OptimisticLockError } from "../types";

const TABLE = "Sessions";

export const createDynamoDBSessionRepository = (): SessionRepository => ({
  async findById(id) {
    const { Item } = await dynamodb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
    return (Item as Versioned<Session>) ?? null;
  },

  async findByUserId(userId) {
    const { Items } = await dynamodb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "userId-index",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
      }),
    );
    return (Items ?? []) as Versioned<Session>[];
  },

  async create(session) {
    const item: Versioned<Session> = { ...session, version: 1 };
    await dynamodb.send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
    return item;
  },

  async update(session) {
    const nextVersion = session.version + 1;
    try {
      await dynamodb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { id: session.id },
          UpdateExpression:
            "SET #status = :status, costumeId = :costumeId, progress = :progress, videoUrl = :videoUrl, version = :nextVersion",
          ConditionExpression: "version = :currentVersion",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": session.status,
            ":costumeId": session.costumeId,
            ":progress": session.progress,
            ":videoUrl": session.videoUrl ?? null,
            ":currentVersion": session.version,
            ":nextVersion": nextVersion,
          },
        }),
      );
      return { ...session, version: nextVersion };
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw new OptimisticLockError("Session", session.id);
      }
      throw err;
    }
  },
});
