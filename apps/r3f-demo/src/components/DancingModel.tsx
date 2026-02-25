import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export function DancingModel() {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    const loader = new FBXLoader();

    loader.load(
      "/models/womam_with_born_and_separeted_head_body.fbx",
      (fbx) => {
        fbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Z-up → Y-up に変換（Blenderエクスポート設定による）
        fbx.rotation.x = -Math.PI / 2;
        fbx.updateMatrixWorld(true);

        // 高さ1.5mになるようスケール
        const box = new THREE.Box3().setFromObject(fbx);
        const size = box.getSize(new THREE.Vector3());
        const scale = 1.5 / size.y;
        fbx.scale.setScalar(scale);

        // 地面に立たせる
        const adjustedBox = new THREE.Box3().setFromObject(fbx);
        fbx.position.y = -adjustedBox.min.y;

        // 顔テクスチャを頭メッシュに直接マッピング
        attachFaceTextureToMesh(fbx, "/models/free_face.png");

        // ダンスアニメーション
        mixer.current = new THREE.AnimationMixer(fbx);
        const clip = createDanceClip(fbx);
        if (clip) {
          const action = mixer.current.clipAction(clip);
          action.play();
        }

        setScene(fbx);
      },
      undefined,
      (error) => {
        console.error("FBX load error:", error);
      },
    );

    return () => {
      mixer.current?.stopAllAction();
      mixer.current = null;
    };
  }, []);

  useFrame((_, delta) => {
    mixer.current?.update(delta);
  });

  if (!scene) {
    return null;
  }
  return <primitive object={scene} />;
}

function attachFaceTextureToMesh(model: THREE.Object3D, imageUrl: string) {
  let targetMesh: THREE.SkinnedMesh | null = null;
  model.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      targetMesh = child as THREE.SkinnedMesh;
    }
  });

  if (!targetMesh) {
    return;
  }

  const mesh = targetMesh as THREE.SkinnedMesh;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const groups = mesh.geometry.groups;

  // headマテリアルのインデックスを探す
  const headIndex = materials.findIndex((m) => m.name === "head");
  if (headIndex === -1) {
    console.warn(
      "head material not found, available:",
      materials.map((m) => m.name),
    );
    return;
  }

  // 頭部UVを0〜1にリマップ（元のUVは全身用で頭部が極小範囲に収まっている）
  const uv = mesh.geometry.attributes.uv;
  const headGroup = groups.find((g) => g.materialIndex === headIndex);
  if (headGroup && uv) {
    let minU = Infinity,
      maxU = -Infinity,
      minV = Infinity,
      maxV = -Infinity;
    for (let i = headGroup.start; i < headGroup.start + headGroup.count; i++) {
      minU = Math.min(minU, uv.getX(i));
      maxU = Math.max(maxU, uv.getX(i));
      minV = Math.min(minV, uv.getY(i));
      maxV = Math.max(maxV, uv.getY(i));
    }
    const rangeU = maxU - minU || 1;
    const rangeV = maxV - minV || 1;
    for (let i = headGroup.start; i < headGroup.start + headGroup.count; i++) {
      uv.setXY(i, (uv.getX(i) - minU) / rangeU, (uv.getY(i) - minV) / rangeV);
    }
    uv.needsUpdate = true;
  }

  // 頂点法線のY成分で前面/後面フラグを設定（モデル空間でY軸が前後方向）
  const normals = mesh.geometry.attributes.normal;
  const faceFlag = new Float32Array(normals.count);
  if (headGroup) {
    for (let i = headGroup.start; i < headGroup.start + headGroup.count; i++) {
      // Blender -Y forward: 法線Yが負なら顔の前面
      faceFlag[i] = normals.getY(i) < 0 ? 1.0 : 0.0;
    }
  }
  mesh.geometry.setAttribute("faceFlag", new THREE.BufferAttribute(faceFlag, 1));

  // 顔テクスチャを読み込んでheadマテリアルに適用
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(imageUrl, (texture) => {
    const headMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });

    headMat.onBeforeCompile = (shader) => {
      shader.uniforms.hairColor = { value: new THREE.Color(0x2a1a0a) };

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
        attribute float faceFlag;
        varying float vFaceFlag;`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vFaceFlag = faceFlag;`,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
        uniform vec3 hairColor;
        varying float vFaceFlag;`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        if (vFaceFlag < 0.5) {
          diffuseColor = vec4(hairColor, 1.0);
        }`,
      );
    };

    const newMaterials = [...materials];
    newMaterials[headIndex] = headMat;
    mesh.material = newMaterials;
  });
}

function findBone(model: THREE.Object3D, name: string): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  model.traverse((child) => {
    if ((child as THREE.Bone).isBone && child.name === name) {
      found = child as THREE.Bone;
    }
  });
  return found;
}

function createDanceClip(model: THREE.Object3D): THREE.AnimationClip | null {
  const tracks: THREE.KeyframeTrack[] = [];
  const bpm = 120;
  const beatDuration = 60 / bpm;
  const duration = beatDuration * 8; // 8拍分
  const steps = 64;
  const times = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * duration);

  const beat = (t: number) => t / beatDuration;

  // --- spine (ルートボーン): 上下バウンス ---
  const spine = findBone(model, "spine");
  if (spine) {
    const baseY = spine.position.y;
    // 毎ビートで沈んで戻る
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "spine.position[y]",
        times,
        times.map((t) => baseY + Math.sin(beat(t) * Math.PI * 2) * 0.03),
      ),
    );
    // 腰の左右スウェイ
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "spine.rotation[z]",
        times,
        times.map((t) => Math.sin(beat(t) * Math.PI) * 0.06),
      ),
    );
  }

  // --- spine001: 胴体のツイスト ---
  const spine001 = findBone(model, "spine001");
  if (spine001) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "spine001.rotation[y]",
        times,
        times.map((t) => Math.sin(beat(t) * Math.PI) * 0.1),
      ),
    );
  }

  // --- spine003: 上体の前後ノリ ---
  const spine003 = findBone(model, "spine003");
  if (spine003) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "spine003.rotation[x]",
        times,
        times.map((t) => Math.sin(beat(t) * Math.PI * 2) * 0.05),
      ),
    );
  }

  // --- 右腕: 振り上げ ---
  const upperArmR = findBone(model, "upper_armR");
  if (upperArmR) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "upper_armR.rotation[z]",
        times,
        times.map((t) => -1.2 + Math.sin(beat(t) * Math.PI) * 0.4),
      ),
    );
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "upper_armR.rotation[x]",
        times,
        times.map((t) => Math.sin(beat(t) * Math.PI * 2) * 0.3),
      ),
    );
  }

  // --- 左腕: 逆位相で振り ---
  const upperArmL = findBone(model, "upper_armL");
  if (upperArmL) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "upper_armL.rotation[z]",
        times,
        times.map((t) => 1.2 + Math.sin(beat(t) * Math.PI + Math.PI) * 0.4),
      ),
    );
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "upper_armL.rotation[x]",
        times,
        times.map((t) => Math.sin(beat(t) * Math.PI * 2 + Math.PI) * 0.3),
      ),
    );
  }

  // --- 前腕: 曲げ ---
  const forearmR = findBone(model, "forearmR");
  if (forearmR) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "forearmR.rotation[z]",
        times,
        times.map((t) => Math.sin(beat(t) * Math.PI * 2) * 0.3 - 0.2),
      ),
    );
  }
  const forearmL = findBone(model, "forearmL");
  if (forearmL) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "forearmL.rotation[z]",
        times,
        times.map((t) => Math.sin(beat(t) * Math.PI * 2 + Math.PI) * 0.3 + 0.2),
      ),
    );
  }

  // --- 右脚: ステップ ---
  const thighR = findBone(model, "thighR");
  if (thighR) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "thighR.rotation[x]",
        times,
        times.map((t) => Math.max(0, Math.sin(beat(t) * Math.PI * 2)) * 0.3),
      ),
    );
  }
  const shinR = findBone(model, "shinR");
  if (shinR) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "shinR.rotation[x]",
        times,
        times.map((t) => Math.max(0, Math.sin(beat(t) * Math.PI * 2)) * -0.4),
      ),
    );
  }

  // --- 左脚: 逆位相ステップ ---
  const thighL = findBone(model, "thighL");
  if (thighL) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "thighL.rotation[x]",
        times,
        times.map((t) => Math.max(0, Math.sin(beat(t) * Math.PI * 2 + Math.PI)) * 0.3),
      ),
    );
  }
  const shinL = findBone(model, "shinL");
  if (shinL) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "shinL.rotation[x]",
        times,
        times.map((t) => Math.max(0, Math.sin(beat(t) * Math.PI * 2 + Math.PI)) * -0.4),
      ),
    );
  }

  // --- 頭: リズムに合わせて揺れ ---
  const spine006 = findBone(model, "spine006");
  if (spine006) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "spine006.rotation[z]",
        times,
        times.map((t) => Math.sin(beat(t) * Math.PI) * 0.08),
      ),
    );
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "spine006.rotation[x]",
        times,
        times.map((t) => Math.sin(beat(t) * Math.PI * 2) * 0.05),
      ),
    );
  }

  // --- 肩: 上下 ---
  const shoulderR = findBone(model, "shoulderR");
  if (shoulderR) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "shoulderR.rotation[z]",
        times,
        times.map((t) => Math.sin(beat(t) * Math.PI * 2) * 0.05),
      ),
    );
  }
  const shoulderL = findBone(model, "shoulderL");
  if (shoulderL) {
    tracks.push(
      new THREE.NumberKeyframeTrack(
        "shoulderL.rotation[z]",
        times,
        times.map((t) => Math.sin(beat(t) * Math.PI * 2 + Math.PI) * 0.05),
      ),
    );
  }

  if (tracks.length === 0) {
    return null;
  }
  return new THREE.AnimationClip("Dance", duration, tracks);
}
