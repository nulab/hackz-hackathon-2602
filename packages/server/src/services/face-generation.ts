import { buildNovaCanvasRequest } from "../domain/face-generation";
import { invokeBedrock } from "./bedrock";
import { uploadFile } from "./s3";

export const generateFaceIllustration = async (
  userId: string,
  base64Image: string,
): Promise<{ faceImageUrl: string }> => {
  const request = buildNovaCanvasRequest(base64Image);
  const response = await invokeBedrock("amazon.nova-canvas-v1:0", request);
  const images = response.images as string[];

  if (!images || images.length === 0) {
    throw new Error("Nova Canvas returned no images");
  }

  const imageBuffer = Buffer.from(images[0], "base64");
  const faceImageUrl = await uploadFile(`face/${userId}.png`, imageBuffer, "image/png");

  return { faceImageUrl };
};
