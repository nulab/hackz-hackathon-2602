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

// This texture is projected flat onto the front face of a low-poly 3D head mesh.
// The back of the head uses a solid dark brown color (#2a1a0a).
// Therefore the generated image must:
//   - Fill the entire square with the face (no background at all)
//   - Have hair/dark tones at the top and side edges so they blend with the back color
//   - Have skin tones at the bottom edge (chin/neck area)
//   - Use a retro low-poly game aesthetic (PS2 era, ~2000s)
export const buildNovaCanvasRequest = (base64Image: string) => ({
  taskType: "IMAGE_VARIATION",
  imageVariationParams: {
    text: [
      "Front-facing UV face texture map for a low-poly 3D character head.",
      "OUTPUT: Flat square image, face fills 100% of canvas, zero background/margin/padding. No 3D perspective or shadows — flat diffuse texture.",
      "LAYOUT top-to-bottom: Dark brown/black hair at top edge (#2a1a0a). Forehead. Eyebrows. Eyes (preserve subject's eye color/shape). Nose. Mouth. Chin/jawline at bottom edge. Side edges show hair/dark tones blending with back-of-head color (#2a1a0a).",
      "PRESERVE: exact eye color, hair color, skin tone, facial hair, glasses. Must be recognizable from original.",
      "STYLE: PS1/PS2 era low-poly game texture. Limited palette (max 64 colors), flat matte shading, no specular highlights, color banding, slightly exaggerated. Ref: Virtua Fighter, FF VII-X, Tekken 3.",
    ].join(" "),
    negativeText:
      "background, scenery, room, wall, sky, shoulders, torso, body, clothing, necklace, frame, border, margin, padding, 3D rendering, depth, perspective, shadow, specular highlight, photorealistic, hyper-detailed, smooth gradient, modern rendering, anime, cartoon, text, watermark, logo, blurry, distorted, deformed",
    images: [base64Image],
    similarityStrength: 0.55,
  },
  imageGenerationConfig: {
    numberOfImages: 1,
    height: 1024,
    width: 1024,
    cfgScale: 10.0,
  },
});
