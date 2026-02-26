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
    text: "A clean, front-facing anime-style face illustration suitable for 3D model texture mapping. Smooth cel-shaded coloring, clear outlines, symmetrical features, neutral expression, solid white background.",
    negativeText:
      "blurry, distorted, deformed, asymmetric, dark background, photorealistic, text, watermark",
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
