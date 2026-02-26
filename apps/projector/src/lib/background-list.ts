import textureCastle from "../assets/backgrounds/texture_castle.png";
import textureDancestage from "../assets/backgrounds/texture_dancestage.png";
import textureFashionstreet from "../assets/backgrounds/texture_fashionstreet.png";
import textureShell from "../assets/backgrounds/texture_shell.png";

export const BACKGROUND_PATHS = [
  textureCastle,
  textureDancestage,
  textureFashionstreet,
  textureShell,
];

export function pickRandomBackground(): string {
  const index = Math.floor(Math.random() * BACKGROUND_PATHS.length);
  return BACKGROUND_PATHS[index];
}
