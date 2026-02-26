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

export const buildNovaProDescribeRequest = (base64Image: string) => ({
  schemaVersion: "messages-v1",
  messages: [
    {
      role: "user",
      content: [
        {
          image: {
            format: "jpeg",
            source: { bytes: base64Image },
          },
        },
        {
          text: "Describe this person's face for a 3D texture map.",
        },
      ],
    },
  ],
  system: [
    {
      text: [
        "You are a 3D texture artist creating UV face texture maps for low-poly game characters (PS1/PS2 era).",
        "Given a face photo, describe ONLY the visual features needed for a flat texture map that fills an entire square canvas edge-to-edge:",
        "- Hair: color, style, coverage at top and side edges",
        "- Skin: tone, complexion",
        "- Eyes: color, shape, distinctive features",
        "- Facial hair: beard, mustache, stubble (if any)",
        "- Accessories: glasses, piercings (if any)",
        "- Face shape and proportions",
        "Output a single paragraph describing how these features should be arranged on the texture map.",
        "Do NOT mention the person's name, identity, age, ethnicity, or any personal information.",
        "Do NOT describe background, clothing, or anything below the neck.",
      ].join(" "),
    },
  ],
  inferenceConfig: {
    max_new_tokens: 300,
    temperature: 0.3,
  },
});

// This texture is projected flat onto the front face of a low-poly 3D head mesh.
// The back of the head uses a solid dark brown color (#2a1a0a).
// Therefore the generated image must:
//   - Fill the entire square with the face (no background at all)
//   - Have hair/dark tones at the top and side edges so they blend with the back color
//   - Have skin tones at the bottom edge (chin/neck area)
//   - Use a retro low-poly game aesthetic (PS2 era, ~2000s)
export const buildNovaCanvasRequest = (base64Image: string, faceDescription: string) => ({
  taskType: "IMAGE_VARIATION",
  imageVariationParams: {
    text: [
      faceDescription,
      "COMPOSITION: A front-facing face filling the entire square canvas edge-to-edge. No background whatsoever. The face occupies 100% of the image area.",
      "EDGES: Top edge and left/right edges fade into dark brown hair (#2a1a0a). Bottom edge shows chin and neck skin. No gaps or margins between the face and canvas edges.",
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
