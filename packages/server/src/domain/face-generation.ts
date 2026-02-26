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
      "A 3DCG texture map image generated from the face in the input photo.",
      "The entire canvas is filled with detailed skin and hair textures.",
      "In the center, the flattened facial features of the person from the input photo are arranged as a texture map: hair at the top, forehead skin, eyes, nose, mouth, chin and jawline at the bottom.",
      "The surrounding area seamlessly extends these textures of skin and hair, creating a complete, high-resolution UV map ready for 3D model application.",
      "STYLE: Early 2000s low-polygon 3D game texture (PS1/PS2 era). Limited color palette, flat matte shading, slightly simplified features, visible color banding. NOT photorealistic, NOT modern anime. Think Virtua Fighter, Final Fantasy VII-X face textures.",
    ].join(" "),
    negativeText:
      "background, scenery, wall, sky, shoulders, body, clothing, frame, border, margin, padding, photorealistic, high detail, smooth gradient, modern rendering, text, watermark, blurry, distorted",
    images: [base64Image],
    similarityStrength: 0.7,
  },
  imageGenerationConfig: {
    numberOfImages: 1,
    height: 512,
    width: 512,
    cfgScale: 8.0,
  },
});
