import { useThree, useLoader } from "@react-three/fiber";
import { useEffect } from "react";
import { TextureLoader } from "three";

export const SceneBackground = ({ path }: { path: string }) => {
  const { scene } = useThree();
  const texture = useLoader(TextureLoader, path);

  useEffect(() => {
    scene.background = texture;
    return () => {
      scene.background = null;
    };
  }, [scene, texture]);

  return null;
};
