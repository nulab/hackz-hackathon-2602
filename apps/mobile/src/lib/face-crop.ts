import * as faceapi from "face-api.js";

let modelsLoaded = false;

const ensureModelsLoaded = async () => {
  if (modelsLoaded) {
    return;
  }
  await faceapi.nets.tinyFaceDetector.loadFromUri("/models/face-detection");
  modelsLoaded = true;
};

const loadImage = (dataURL: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Failed to load image")));
    img.src = dataURL;
  });

export const cropFace = async (dataURL: string): Promise<string> => {
  await ensureModelsLoaded();

  const img = await loadImage(dataURL);

  const detection = await faceapi.detectSingleFace(
    img,
    new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5,
    }),
  );

  const box = detection?.box;
  let cropX: number;
  let cropY: number;
  let cropSize: number;

  if (box) {
    const padding = Math.max(box.width, box.height) * 0.4;
    cropSize = Math.max(box.width, box.height) + padding * 2;
    cropX = box.x + box.width / 2 - cropSize / 2;
    cropY = box.y + box.height / 2 - cropSize / 2;
    cropX = Math.max(0, Math.min(cropX, img.width - cropSize));
    cropY = Math.max(0, Math.min(cropY, img.height - cropSize));
    cropSize = Math.min(cropSize, img.width, img.height);
  } else {
    // Fallback: center crop 70%
    cropSize = Math.min(img.width, img.height) * 0.7;
    cropX = (img.width - cropSize) / 2;
    cropY = Math.max(0, (img.height - cropSize) / 2 - img.height * 0.1);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas 2d context");
  }
  ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, 512, 512);

  return canvas.toDataURL("image/jpeg", 0.85);
};
