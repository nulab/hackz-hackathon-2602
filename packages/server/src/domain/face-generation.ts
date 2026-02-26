const DATA_URL_REGEX = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/;

export const extractBase64FromDataURL = (dataURL: string): { base64: string; mimeType: string } => {
  const match = dataURL.match(DATA_URL_REGEX);
  if (!match) {
    throw new Error("Invalid data URL format");
  }
  return { mimeType: match[1], base64: match[2] };
};

export const validatePhotoSize = (base64: string, maxBytes: number): void => {
  const sizeInBytes = Math.ceil((base64.length * 3) / 4);
  if (sizeInBytes > maxBytes) {
    throw new Error(`Photo size ${sizeInBytes} bytes exceeds maximum ${maxBytes} bytes`);
  }
};

export const buildNovaCanvasRequest = (base64Image: string) => ({
  taskType: "IMAGE_VARIATION",
  imageVariationParams: {
    text: "A front-facing face and hair illustration for a 3D character model texture. The face and hair must fill the entire rectangular canvas with NO background visible. Low-poly PS2-era game texture style: limited color palette, flat shading, slightly pixelated, early 2000s CG aesthetic. Simple geometric features, muted tones, minimal detail like a UV-mapped face texture from a low-polygon 3D model.",
    negativeText:
      "background, scenery, sky, room, photorealistic, high detail, smooth gradient, modern rendering, text, watermark, blurry, distorted, deformed",
    images: [base64Image],
    similarityStrength: 0.7,
  },
  imageGenerationConfig: {
    numberOfImages: 1,
    height: 512,
    width: 512,
    cfgScale: 7.0,
  },
});
