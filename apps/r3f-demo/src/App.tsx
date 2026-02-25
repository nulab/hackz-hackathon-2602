import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { DancingModel } from "./components/DancingModel";

export function App() {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#000" }}>
      <Canvas camera={{ position: [0, 1.5, 3], fov: 50 }} shadows>
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 5, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <DancingModel />
        <axesHelper args={[2]} />
        <OrbitControls target={[0, 1, 0]} minDistance={1.5} maxDistance={8} />
        <gridHelper args={[10, 10, "#888888", "#444444"]} />
      </Canvas>
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          color: "#fff",
          background: "rgba(0,0,0,0.5)",
          borderRadius: 4,
          padding: "8px 12px",
          fontSize: 14,
        }}
      >
        R3F Dance Demo - ドラッグ: 回転 / スクロール: ズーム
      </div>
    </div>
  );
}
