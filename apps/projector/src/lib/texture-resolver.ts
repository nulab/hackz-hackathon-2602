type BuildTextures = {
  face: string;
  tops: string;
  bottoms: string;
  shoes: string;
};

const DEFAULTS: BuildTextures = {
  face: "/models/free_face.png",
  tops: "/models/sozai_tops.png",
  bottoms: "/models/sozai_bottoms_vivid.png",
  shoes: "/models/sozai_shoes.png",
};

type BuildData = {
  upperId?: string;
  lowerId?: string;
  shoesId?: string;
};

const resolveItemTexture = (itemId: string | undefined, fallback: string): string => {
  if (!itemId) {
    return fallback;
  }
  return `/costumes/texture_${itemId}.png`;
};

export const resolveTextures = (photoUrl?: string, build?: BuildData | null): BuildTextures => ({
  face: photoUrl || DEFAULTS.face,
  tops: resolveItemTexture(build?.upperId, DEFAULTS.tops),
  bottoms: resolveItemTexture(build?.lowerId, DEFAULTS.bottoms),
  shoes: resolveItemTexture(build?.shoesId, DEFAULTS.shoes),
});
