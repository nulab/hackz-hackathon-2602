import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { TextureLoader } from "three";

export const SceneBackground = ({ path }: { path: string }) => {
  const { scene } = useThree();

  useEffect(() => {
    const loader = new TextureLoader();
    loader.load(path, (texture) => {
      scene.background = texture;
    });

    return () => {
      scene.background = null;
    };
  }, [scene, path]);

  return null;
};
