import { useEffect, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Canvas } from "@react-three/fiber";
import { trpc } from "../lib/trpc";
import { CharacterModel } from "../components/viewer/CharacterModel";
import { SceneBackground } from "../components/viewer/SceneBackground";
import { FullscreenButton } from "../components/viewer/FullscreenButton";
import { IdleScreen } from "../components/viewer/IdleScreen";
import { resolveTextures } from "../lib/texture-resolver";
import { pickRandomBackground } from "../lib/background-list";

const ViewerPage = () => {
  useEffect(() => {
    if (!("wakeLock" in navigator)) {
      return;
    }

    let sentinel: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // Low battery or other OS-level restriction
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sentinel?.release();
    };
  }, []);
  const { data } = trpc.projectorViewer.getActiveUser.useQuery(undefined, {
    refetchInterval: 2000,
  });

  const user = data?.user ?? null;
  const build = data?.build ?? null;
  const textures = resolveTextures(user?.photoUrl, build);

  const prevUserIdRef = useRef<string | null>(null);
  const bgPath = useMemo(() => {
    if (!user) {
      return null;
    }
    // Re-pick when user changes
    prevUserIdRef.current = user.id;
    return pickRandomBackground();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
        {user && bgPath && <SceneBackground path={bgPath} />}
        {user && (
          <CharacterModel
            key={user.id}
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
