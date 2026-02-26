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

export const resolveTextures = (photoUrl?: string): BuildTextures => ({
  face: photoUrl || DEFAULTS.face,
  tops: DEFAULTS.tops,
  bottoms: DEFAULTS.bottoms,
  shoes: DEFAULTS.shoes,
});
