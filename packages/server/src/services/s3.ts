import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";

const isLocal = !!process.env.DYNAMODB_ENDPOINT;
const LOCAL_UPLOAD_DIR = join(process.cwd(), ".local", "uploads");
const PORT = process.env.PORT || "3000";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

const BUCKET = process.env.S3_BUCKET || "hackz-nulab-26";

export const uploadFile = async (
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> => {
  if (isLocal) {
    const filePath = join(LOCAL_UPLOAD_DIR, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    return `http://localhost:${PORT}/uploads/${key}`;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return `https://${BUCKET}.s3.amazonaws.com/${key}`;
};

export const getFile = async (key: string) => {
  if (isLocal) {
    const filePath = join(LOCAL_UPLOAD_DIR, key);
    const buffer = await readFile(filePath);
    return new Blob([buffer]).stream();
  }

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );
  return response.Body;
};
