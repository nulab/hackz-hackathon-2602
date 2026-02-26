import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { TextureLoader } from "three";

export const SceneBackground = ({ path }: { path: string }) => {
  const { scene } = useThree();

  useEffect(() => {
    const loader = new TextureLoader();
    loader.load(path, (texture) => {
      // @ts-expect-error @types/three version mismatch (0.173.0 vs 0.183.1)
      scene.background = texture;
    });

    return () => {
      scene.background = null;
    };
  }, [scene, path]);

  return null;
};
