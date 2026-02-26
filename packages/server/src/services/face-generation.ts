import sharp from "sharp";
import { buildSD35ImageToImageRequest } from "../domain/face-generation";
import { computeCropRegion } from "../domain/face-crop";
import { detectFaceBoundingBox } from "./rekognition";
import { invokeBedrockUsEast1 } from "./bedrock";
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

  const request = buildSD35ImageToImageRequest(croppedBase64);
  const response = await invokeBedrockUsEast1("stability.sd3-5-large-v1:0", request);

  const finishReasons = response.finish_reasons as (string | null)[];
  if (finishReasons?.[0] === "content_filtered") {
    throw new Error("SD 3.5 Large: image was filtered by content moderation");
  }

  const images = response.images as string[];
  if (!images || images.length === 0) {
    throw new Error("SD 3.5 Large returned no images");
  }

  const imageBuffer = Buffer.from(images[0], "base64");
  const faceImageUrl = await uploadFile(`face/${userId}.png`, imageBuffer, "image/png");

  return { faceImageUrl };
};
