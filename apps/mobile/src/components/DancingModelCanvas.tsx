import { Canvas } from "@react-three/fiber";
import { DancingModel } from "./DancingModel";

export function DancingModelCanvas() {
  return (
    <div style={{ width: "10rem", height: "14rem", position: "relative", zIndex: 1 }}>
      <Canvas camera={{ position: [0, 0.8, 2.2], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 3]} intensity={0.8} />
        <DancingModel />
      </Canvas>
    </div>
  );
}
