import { createFileRoute } from "@tanstack/react-router";
import { Canvas } from "@react-three/fiber";
import { trpc } from "../lib/trpc";
import { CharacterModel } from "../components/viewer/CharacterModel";
import { FullscreenButton } from "../components/viewer/FullscreenButton";
import { IdleScreen } from "../components/viewer/IdleScreen";
import { resolveTextures } from "../lib/texture-resolver";

const ViewerPage = () => {
  const { data } = trpc.projectorViewer.getActiveUser.useQuery(undefined, {
    refetchInterval: 2000,
  });

  const user = data?.user ?? null;
  const build = data?.build ?? null;
  const textures = resolveTextures(user?.photoUrl, build);

  return (
    <div className="fixed inset-0 bg-black">
      <FullscreenButton />
      {!user && <IdleScreen />}
      <Canvas
        camera={{ position: [0, 0.75, 2.5], fov: 45 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.75, 0)}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 3]} intensity={0.8} />
        {user && (
          <CharacterModel
            faceImageUrl={textures.face}
            topsUrl={textures.tops}
            bottomsUrl={textures.bottoms}
            shoesUrl={textures.shoes}
          />
        )}
      </Canvas>
    </div>
  );
};

export const Route = createFileRoute("/viewer")({
  component: ViewerPage,
});
