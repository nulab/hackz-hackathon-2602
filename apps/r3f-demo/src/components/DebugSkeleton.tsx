import { useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

/**
 * Mixamo FBX をリターゲットなしでそのまま再生し、
 * SkeletonHelper でボーンの動きを可視化するデバッグ用コンポーネント
 */
export const DebugSkeleton = ({ url = "/models/Capoeira.fbx", offsetX = 2 }) => {
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const { scene } = useThree();
  const helperRef = useRef<THREE.SkeletonHelper | null>(null);

  useEffect(() => {
    const loader = new FBXLoader();

    loader.load(
      url,
      (fbx) => {
        console.log("[DebugSkeleton] FBX loaded, animations:", fbx.animations.length);

        // スケール調整（Mixamo FBXのスケルトンサイズに合わせる）
        const box = new THREE.Box3().setFromObject(fbx);
        const size = box.getSize(new THREE.Vector3());
        if (size.y > 10) {
          // cm単位の場合
          const s = 1.5 / size.y;
          fbx.scale.setScalar(s);
        }

        // 横にオフセット
        fbx.position.x = offsetX;

        // 地面に立たせる
        fbx.updateMatrixWorld(true);
        const adjustedBox = new THREE.Box3().setFromObject(fbx);
        fbx.position.y = -adjustedBox.min.y;

        // アニメーション再生（リターゲットなし、そのまま）
        if (fbx.animations.length > 0) {
          mixer.current = new THREE.AnimationMixer(fbx);
          const action = mixer.current.clipAction(fbx.animations[0]);
          action.play();
          console.log(
            `[DebugSkeleton] Playing: "${fbx.animations[0].name}", ${fbx.animations[0].duration.toFixed(2)}s`,
          );
        }

        // SkeletonHelper を追加（ボーンを線で描画）
        const helper = new THREE.SkeletonHelper(fbx);
        (helper.material as THREE.LineBasicMaterial).linewidth = 2;
        scene.add(helper);
        helperRef.current = helper;

        setGroup(fbx);
      },
      undefined,
      (error) => {
        console.error("[DebugSkeleton] Load error:", error);
      },
    );

    return () => {
      mixer.current?.stopAllAction();
      mixer.current = null;
      if (helperRef.current) {
        scene.remove(helperRef.current);
        helperRef.current = null;
      }
    };
  }, [url, offsetX, scene]);

  useFrame((_, delta) => {
    mixer.current?.update(delta);
  });

  if (!group) {
    return null;
  }
  return <primitive object={group} />;
};
