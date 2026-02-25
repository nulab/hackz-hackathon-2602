import { Canvas } from "@react-three/fiber";
import { DancingModel } from "./DancingModel";

export const DancingModelCanvas = () => (
  <div style={{ width: "100%", aspectRatio: "1", position: "relative", zIndex: 1 }}>
    <Canvas
      camera={{ position: [0, 0.75, 2.0], fov: 50 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.75, 0)}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 3]} intensity={0.8} />
      <DancingModel />
    </Canvas>
  </div>
);
