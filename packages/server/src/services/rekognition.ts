import { RekognitionClient, DetectFacesCommand } from "@aws-sdk/client-rekognition";
import type { BoundingBox } from "../domain/face-crop";

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

export const detectFaceBoundingBox = async (
  imageBytes: Uint8Array,
): Promise<BoundingBox | null> => {
  const response = await rekognition.send(
    new DetectFacesCommand({
      Image: { Bytes: imageBytes },
      Attributes: ["DEFAULT"],
    }),
  );

  const face = response.FaceDetails?.[0];
  if (!face?.BoundingBox) {
    return null;
  }

  const { Left, Top, Width, Height } = face.BoundingBox;
  return {
    left: Left ?? 0,
    top: Top ?? 0,
    width: Width ?? 0,
    height: Height ?? 0,
  };
};
