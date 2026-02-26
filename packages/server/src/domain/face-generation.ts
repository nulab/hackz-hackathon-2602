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
      "A front-facing UV face texture map for a low-poly 3D character head model.",
      "OUTPUT FORMAT: A single flat square image. The face fills 100% of the canvas with zero background, zero margin, zero padding. No 3D perspective, no lighting shadows — purely a flat diffuse texture sheet.",
      "LAYOUT top-to-bottom: Dark brown/black hair filling the top edge (#2a1a0a). Forehead skin. Eyebrows. Eyes (preserve the subject's eye color and shape). Nose. Mouth. Chin and jawline skin at the bottom edge. Left and right edges show hair or dark tones that blend with the back-of-head color (#2a1a0a).",
      "PRESERVE from input: exact eye color, hair color, skin tone, facial hair if any, glasses if any. These features must be recognizable from the original photo.",
      "STYLE: Early 2000s low-polygon 3D game texture (PS1/PS2 era). Simplified geometry, limited color palette (max 64 colors), flat matte shading with no specular highlights, visible color banding, slightly exaggerated features. Reference: Virtua Fighter, Final Fantasy VII-X, Tekken 3 face textures.",
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
