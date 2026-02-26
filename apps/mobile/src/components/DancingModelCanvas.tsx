import { Canvas } from "@react-three/fiber";
import { DancingModel } from "./DancingModel";

type Props = {
  faceImageUrl?: string | null;
};

export const DancingModelCanvas = ({ faceImageUrl }: Props) => (
  <div style={{ width: "100%", aspectRatio: "1/2", position: "relative", zIndex: 1 }}>
    <Canvas
      camera={{ position: [0, 0.75, 1.8], fov: 50 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.75, 0)}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 3]} intensity={0.8} />
      <DancingModel faceImageUrl={faceImageUrl} />
    </Canvas>
  </div>
);
