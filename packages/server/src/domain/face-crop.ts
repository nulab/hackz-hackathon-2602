export type BoundingBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CropRegion = {
  x: number;
  y: number;
  size: number;
};

const PADDING_RATIO = 0.4;
const FALLBACK_CROP_RATIO = 0.7;

export const computeCropRegion = (
  box: BoundingBox | null,
  imageWidth: number,
  imageHeight: number,
): CropRegion => {
  if (!box) {
    const cropSize = Math.min(imageWidth, imageHeight) * FALLBACK_CROP_RATIO;
    return {
      x: Math.round((imageWidth - cropSize) / 2),
      y: Math.round(Math.max(0, (imageHeight - cropSize) / 2 - imageHeight * 0.1)),
      size: Math.round(cropSize),
    };
  }

  const pixelX = box.left * imageWidth;
  const pixelY = box.top * imageHeight;
  const pixelW = box.width * imageWidth;
  const pixelH = box.height * imageHeight;

  const padding = Math.max(pixelW, pixelH) * PADDING_RATIO;
  let cropSize = Math.max(pixelW, pixelH) + padding * 2;

  const centerX = pixelX + pixelW / 2;
  const centerY = pixelY + pixelH / 2;
  let cropX = centerX - cropSize / 2;
  let cropY = centerY - cropSize / 2;

  cropX = Math.max(0, Math.min(cropX, imageWidth - cropSize));
  cropY = Math.max(0, Math.min(cropY, imageHeight - cropSize));
  cropSize = Math.min(cropSize, imageWidth, imageHeight);

  return {
    x: Math.round(cropX),
    y: Math.round(cropY),
    size: Math.round(cropSize),
  };
};
