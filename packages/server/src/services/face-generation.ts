import sharp from "sharp";
import { buildNovaCanvasRequest, buildNovaProDescribeRequest } from "../domain/face-generation";
import { computeCropRegion } from "../domain/face-crop";
import { detectFaceBoundingBox } from "./rekognition";
import { invokeBedrock } from "./bedrock";
import { uploadFile } from "./s3";

const CROP_OUTPUT_SIZE = 512;

export const cropFaceFromImage = async (base64Image: string): Promise<string> => {
  const imageBuffer = Buffer.from(base64Image, "base64");
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const boundingBox = await detectFaceBoundingBox(new Uint8Array(imageBuffer));
  const region = computeCropRegion(boundingBox, width, height);

  const croppedBuffer = await sharp(imageBuffer)
    .extract({ left: region.x, top: region.y, width: region.size, height: region.size })
    .resize(CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE)
    .jpeg({ quality: 85 })
    .toBuffer();

  return croppedBuffer.toString("base64");
};

export const generateFaceIllustration = async (
  userId: string,
  base64Image: string,
): Promise<{ faceImageUrl: string }> => {
  const croppedBase64 = await cropFaceFromImage(base64Image);

  // Step 1: Nova Pro で顔の特徴をテキスト化
  const describeRequest = buildNovaProDescribeRequest(croppedBase64);
  const describeResponse = await invokeBedrock("ap.amazon.nova-pro-v1:0", describeRequest);
  const faceDescription =
    (describeResponse.output as { message?: { content?: { text?: string }[] } })?.message
      ?.content?.[0]?.text ?? "";

  // Step 2: テキスト記述を使って Nova Canvas でテクスチャ生成
  const request = buildNovaCanvasRequest(croppedBase64, faceDescription);
  const response = await invokeBedrock("amazon.nova-canvas-v1:0", request);
  const images = response.images as string[];

  if (!images || images.length === 0) {
    throw new Error("Nova Canvas returned no images");
  }

  const imageBuffer = Buffer.from(images[0], "base64");
  const faceImageUrl = await uploadFile(`face/${userId}.png`, imageBuffer, "image/png");

  return { faceImageUrl };
};
