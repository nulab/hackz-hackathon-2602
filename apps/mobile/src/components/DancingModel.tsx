import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

// --- Mixamo FBX からアニメーションだけ取り出す ---
// position トラックはルートモーションでモデルが吹っ飛ぶため除外し、回転のみ適用
const loadAnimationFromFBX = (url: string): Promise<THREE.AnimationClip | null> =>
  new Promise((resolve) => {
    const loader = new FBXLoader();
    loader.load(
      url,
      (fbx) => {
        if (fbx.animations.length > 0) {
          const clip = fbx.animations[0];
          clip.tracks = clip.tracks.filter((t) => !t.name.endsWith(".position"));
          resolve(clip);
        } else {
          resolve(null);
        }
      },
      undefined,
      () => resolve(null),
    );
  });

// --- テクスチャ画像を読み込み → クロップ → 加工 → CanvasTexture ---
const loadProcessedTexture = (
  url: string,
  opts: { bgColor?: string; bgRGB?: [number, number, number] } = {},
): Promise<THREE.CanvasTexture> =>
  new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(url, (texture) => {
      const img = texture.image as HTMLImageElement;

      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = img.width;
      tmpCanvas.height = img.height;
      const tmpCtx = tmpCanvas.getContext("2d")!;
      tmpCtx.drawImage(img, 0, 0);
      const imageData = tmpCtx.getImageData(0, 0, img.width, img.height);
      const pixels = imageData.data;

      // コンテンツ領域のバウンディングボックス検出 + 不透明ピクセルの平均色算出
      let cMinX = img.width,
        cMaxX = 0,
        cMinY = img.height,
        cMaxY = 0;
      let avgR = 0,
        avgG = 0,
        avgB = 0,
        opaqueCount = 0;
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const idx = (y * img.width + x) * 4;
          if (pixels[idx + 3] > 10) {
            cMinX = Math.min(cMinX, x);
            cMaxX = Math.max(cMaxX, x);
            cMinY = Math.min(cMinY, y);
            cMaxY = Math.max(cMaxY, y);
            avgR += pixels[idx];
            avgG += pixels[idx + 1];
            avgB += pixels[idx + 2];
            opaqueCount++;
          }
        }
      }
      if (opaqueCount > 0) {
        avgR = Math.round(avgR / opaqueCount);
        avgG = Math.round(avgG / opaqueCount);
        avgB = Math.round(avgB / opaqueCount);
      }

      const cropW = cMaxX - cMinX + 1;
      const cropH = cMaxY - cMinY + 1;
      const fillRGB: [number, number, number] = opts.bgRGB ?? [avgR, avgG, avgB];

      const canvas = document.createElement("canvas");
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d")!;
      const fillColor = opts.bgColor ?? `rgb(${fillRGB[0]},${fillRGB[1]},${fillRGB[2]})`;
      ctx.fillStyle = fillColor;
      ctx.fillRect(0, 0, cropW, cropH);
      ctx.drawImage(img, cMinX, cMinY, cropW, cropH, 0, 0, cropW, cropH);

      // 透明ピクセルを平均色で埋める（premultiply補正も兼ねる）
      const outData = ctx.getImageData(0, 0, cropW, cropH);
      const px = outData.data;
      for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3];
        if (a > 10 && a < 255) {
          const f = 255 / a;
          px[i] = Math.min(255, Math.round(px[i] * f));
          px[i + 1] = Math.min(255, Math.round(px[i + 1] * f));
          px[i + 2] = Math.min(255, Math.round(px[i + 2] * f));
          px[i + 3] = 255;
        } else if (a <= 10) {
          px[i] = fillRGB[0];
          px[i + 1] = fillRGB[1];
          px[i + 2] = fillRGB[2];
          px[i + 3] = 255;
        }
      }
      ctx.putImageData(outData, 0, 0);

      const canvasTex = new THREE.CanvasTexture(canvas);
      canvasTex.colorSpace = THREE.SRGBColorSpace;
      canvasTex.wrapS = THREE.RepeatWrapping;
      canvasTex.wrapT = THREE.RepeatWrapping;
      resolve(canvasTex);
    });
  });

// 部位境界の割合定数
const REGION_THRESHOLDS = {
  shoeTop: 0.03,
  bottomTop: 0.6,
  topTop: 0.87,
};

// --- 高さベースで頂点を4部位に分類 → マルチテクスチャシェーダー適用 ---
const applyHeightBasedTextures = async (
  mesh: THREE.Mesh,
  faceImageUrl?: string | null,
  topsUrl?: string,
  bottomsUrl?: string,
  shoesUrl?: string,
) => {
  const geometry = mesh.geometry;
  const pos = geometry.attributes.position;

  // Z範囲を取得（Blender Z-up座標系: Z=高さ）
  let minZ = Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minZ = Math.min(minZ, pos.getZ(i));
    maxZ = Math.max(maxZ, pos.getZ(i));
  }
  const height = maxZ - minZ;

  const shoeTop = minZ + height * REGION_THRESHOLDS.shoeTop;
  const bottomTop = minZ + height * REGION_THRESHOLDS.bottomTop;
  const topTop = minZ + height * REGION_THRESHOLDS.topTop;

  // 部位ごとのX範囲を計算
  const regionRanges = [
    { minX: Infinity, maxX: -Infinity },
    { minX: Infinity, maxX: -Infinity },
    { minX: Infinity, maxX: -Infinity },
    { minX: Infinity, maxX: -Infinity },
  ];

  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const x = pos.getX(i);
    let r = 3;
    if (z < shoeTop) {
      r = 0;
    } else if (z < bottomTop) {
      r = 1;
    } else if (z < topTop) {
      r = 2;
    }
    regionRanges[r].minX = Math.min(regionRanges[r].minX, x);
    regionRanges[r].maxX = Math.max(regionRanges[r].maxX, x);
  }

  // 頂点属性: 部位ID + 局所UV
  const bodyRegion = new Float32Array(pos.count);
  const regionUV = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const x = pos.getX(i);

    let region: number;
    let localV: number;
    if (z < shoeTop) {
      region = 0;
      localV = (z - minZ) / (shoeTop - minZ || 1);
    } else if (z < bottomTop) {
      region = 1;
      localV = (z - shoeTop) / (bottomTop - shoeTop || 1);
    } else if (z < topTop) {
      region = 2;
      localV = (z - bottomTop) / (topTop - bottomTop || 1);
    } else {
      region = 3;
      localV = (z - topTop) / (maxZ - topTop || 1);
    }

    const rr = regionRanges[region];
    const localU = (x - rr.minX) / (rr.maxX - rr.minX || 1);

    bodyRegion[i] = region;
    regionUV[i * 2] = localU;
    regionUV[i * 2 + 1] = localV;
  }

  geometry.setAttribute("bodyRegion", new THREE.BufferAttribute(bodyRegion, 1));
  geometry.setAttribute("regionUV", new THREE.BufferAttribute(regionUV, 2));

  // 4テクスチャ並行読み込み（顔はユーザー画像またはデフォルト）
  const headTextureUrl = faceImageUrl || "/models/free_face.png";
  const [headTex, topsTex, bottomsTex, shoesTex] = await Promise.all([
    loadProcessedTexture(headTextureUrl, { bgColor: "#2a1a0a" }),
    loadProcessedTexture(topsUrl || "/models/sozai_tops.png"),
    loadProcessedTexture(bottomsUrl || "/models/sozai_bottoms_vivid.png"),
    loadProcessedTexture(shoesUrl || "/models/sozai_shoes.png"),
  ]);

  // マルチテクスチャ・シェーダーマテリアル
  const mat = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.headMap = { value: headTex };
    shader.uniforms.topsMap = { value: topsTex };
    shader.uniforms.bottomsMap = { value: bottomsTex };
    shader.uniforms.shoesMap = { value: shoesTex };
    shader.uniforms.hairColor = { value: new THREE.Color(0x2a1a0a) };

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      attribute float bodyRegion;
      attribute vec2 regionUV;
      varying float vBodyRegion;
      varying vec2 vRegionUV;
      varying vec3 vObjNormal;`,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vBodyRegion = bodyRegion;
      vRegionUV = regionUV;
      vObjNormal = normal;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      uniform sampler2D headMap;
      uniform sampler2D topsMap;
      uniform sampler2D bottomsMap;
      uniform sampler2D shoesMap;
      uniform vec3 hairColor;
      varying float vBodyRegion;
      varying vec2 vRegionUV;
      varying vec3 vObjNormal;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec4 texColor;
      vec2 tiledUV = fract(vRegionUV);
      if (vBodyRegion < 0.5) {
        texColor = texture2D(shoesMap, tiledUV);
      } else if (vBodyRegion < 1.5) {
        texColor = texture2D(bottomsMap, tiledUV);
      } else if (vBodyRegion < 2.5) {
        texColor = texture2D(topsMap, tiledUV);
      } else {
        if (vObjNormal.y < 0.0) {
          texColor = texture2D(headMap, vRegionUV);
        } else {
          texColor = vec4(hairColor, 1.0);
        }
      }
      diffuseColor = texColor;`,
    );
  };

  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map(() => mat);
  } else {
    mesh.material = mat;
  }
};

type DancingModelProps = {
  faceImageUrl?: string | null;
  topsUrl?: string;
  bottomsUrl?: string;
  shoesUrl?: string;
};

// --- メインコンポーネント ---
export const DancingModel = ({
  faceImageUrl,
  topsUrl,
  bottomsUrl,
  shoesUrl,
}: DancingModelProps) => {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    const loader = new FBXLoader();

    loader.load("/models/KissWithSkin.fbx", async (fbx) => {
      fbx.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // スケール調整（1.5m目標）
      const box = new THREE.Box3().setFromObject(fbx);
      const size = box.getSize(new THREE.Vector3());
      fbx.scale.setScalar(1.5 / size.y);

      // 地面に立たせる
      fbx.updateMatrixWorld(true);
      const adj = new THREE.Box3().setFromObject(fbx);
      fbx.position.y = -adj.min.y;

      // まずモデルを表示（テクスチャは後から適用）
      setScene(fbx);

      // 高さベース・マルチテクスチャ適用
      const allMeshes: THREE.Mesh[] = [];
      fbx.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          allMeshes.push(child as THREE.Mesh);
        }
      });
      for (const mesh of allMeshes) {
        await applyHeightBasedTextures(mesh, faceImageUrl, topsUrl, bottomsUrl, shoesUrl);
      }

      // アニメーション適用
      mixer.current = new THREE.AnimationMixer(fbx);
      const clip = await loadAnimationFromFBX("/models/standing_idol.fbx");
      if (clip) {
        mixer.current.clipAction(clip).play();
      }
    });

    return () => {
      mixer.current?.stopAllAction();
      mixer.current = null;
    };
  }, [faceImageUrl, topsUrl, bottomsUrl, shoesUrl]);

  useFrame((_, delta) => {
    mixer.current?.update(delta);
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  if (!scene) {
    return null;
  }
  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
};
