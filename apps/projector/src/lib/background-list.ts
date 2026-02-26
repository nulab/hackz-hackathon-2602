export const BACKGROUND_PATHS = [
  "/backgrounds/texture_castle.png",
  "/backgrounds/texture_dancestage.png",
  "/backgrounds/texture_fashionstreet.png",
  "/backgrounds/texture_shell.png",
];

export function pickRandomBackground(): string {
  const index = Math.floor(Math.random() * BACKGROUND_PATHS.length);
  return BACKGROUND_PATHS[index];
}
