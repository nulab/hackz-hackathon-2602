import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

// --- Mixamo FBX からアニメーションだけ取り出す（リターゲット不要） ---
const loadAnimationFromFBX = (url: string): Promise<THREE.AnimationClip | null> =>
  new Promise((resolve) => {
    const loader = new FBXLoader();
    loader.load(
      url,
      (fbx) => {
        if (fbx.animations.length > 0) {
          const clip = fbx.animations[0];
          console.log(`[Anim] ${url}: "${clip.name}", ${clip.duration.toFixed(2)}s`);
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
  opts: {
    bgColor?: string;
    bgRGB?: [number, number, number];
    fixPremultiply?: boolean;
  } = {},
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

      // bgRGB: 明示指定 or 自動算出の平均色
      const fillRGB: [number, number, number] = opts.bgRGB ?? [avgR, avgG, avgB];

      const canvas = document.createElement("canvas");
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d")!;

      // 背景色で塗りつぶし
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
          // 半透明 → premultiply復元
          const f = 255 / a;
          px[i] = Math.min(255, Math.round(px[i] * f));
          px[i + 1] = Math.min(255, Math.round(px[i + 1] * f));
          px[i + 2] = Math.min(255, Math.round(px[i + 2] * f));
          px[i + 3] = 255;
        } else if (a <= 10) {
          // 透明 → 平均色で埋める
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
      console.log(
        `[Texture] ${url}: ${cropW}x${cropH}, avgColor=rgb(${fillRGB[0]},${fillRGB[1]},${fillRGB[2]})`,
      );
      resolve(canvasTex);
    });
  });

// 部位境界の割合定数（調整用）
const REGION_THRESHOLDS = {
  shoeTop: 0.03, // 靴の上端（身長の3%）
  bottomTop: 0.6, // 下半身の上端（身長の60%）
  topTop: 0.87, // 上半身の上端（身長の87%）
};

// --- 高さベースで頂点を4部位に分類 → マルチテクスチャシェーダー適用 ---
const applyHeightBasedTextures = async (mesh: THREE.Mesh) => {
  const geometry = mesh.geometry;
  const pos = geometry.attributes.position;

  // Z範囲を取得（ジオメトリはBlender Z-up座標系: Z=高さ, Y=奥行き, X=左右）
  let minZ = Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minZ = Math.min(minZ, pos.getZ(i));
    maxZ = Math.max(maxZ, pos.getZ(i));
  }
  const height = maxZ - minZ;
  console.log(
    `[Texture] Z range (height): ${minZ.toFixed(3)} - ${maxZ.toFixed(3)}, height: ${height.toFixed(3)}`,
  );

  // 部位境界（身長に対する割合）
  const shoeTop = minZ + height * REGION_THRESHOLDS.shoeTop;
  const bottomTop = minZ + height * REGION_THRESHOLDS.bottomTop;
  const topTop = minZ + height * REGION_THRESHOLDS.topTop;

  // 部位ごとのX範囲を先に計算
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
  const counts = [0, 0, 0, 0];

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
    counts[region]++;
  }

  geometry.setAttribute("bodyRegion", new THREE.BufferAttribute(bodyRegion, 1));
  geometry.setAttribute("regionUV", new THREE.BufferAttribute(regionUV, 2));

  console.log(
    `[Texture] Vertices: shoes=${counts[0]}, bottoms=${counts[1]}, tops=${counts[2]}, head=${counts[3]}`,
  );

  // 4テクスチャ並行読み込み
  const [headTex, topsTex, bottomsTex, shoesTex] = await Promise.all([
    loadProcessedTexture("/models/free_face.png", { bgColor: "#2a1a0a" }),
    loadProcessedTexture("/models/sozai_tops.png"),
    loadProcessedTexture("/models/sozai_bottoms_vivid.png"),
    loadProcessedTexture("/models/sozai_shoes.png"),
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

    // --- Vertex shader: カスタム attribute/varying 追加 ---
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

    // --- Fragment shader: マルチテクスチャサンプリング ---
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

    // color_fragment の後に差し込み（map不要、直接diffuseColorを上書き）
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec4 texColor;
      vec2 tiledUV = fract(vRegionUV * 2.0);
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

  // 全マテリアルスロットを置き換え
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map(() => mat);
  } else {
    mesh.material = mat;
  }

  console.log("[Texture] Multi-texture material applied");
};

// --- メインコンポーネント ---
export const DancingModel = () => {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [debugLines, setDebugLines] = useState<THREE.Group | null>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const clips = useRef<THREE.AnimationClip[]>([]);
  const currentIndex = useRef(0);

  useEffect(() => {
    const loader = new FBXLoader();

    loader.load(
      "/models/KissWithSkin.fbx",
      async (fbx) => {
        fbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // スケール調整（1.5m目標）
        const box = new THREE.Box3().setFromObject(fbx);
        const size = box.getSize(new THREE.Vector3());
        console.log(
          `[Model] Size: ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}`,
        );
        if (size.y > 2) {
          fbx.scale.setScalar(1.5 / size.y);
        }

        // 地面に立たせる
        fbx.updateMatrixWorld(true);
        const adj = new THREE.Box3().setFromObject(fbx);
        fbx.position.y = -adj.min.y;

        // 高さベース・マルチテクスチャ適用（全Meshに適用）
        const allMeshes: THREE.Mesh[] = [];
        fbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            allMeshes.push(child as THREE.Mesh);
            console.log(
              `[Model] Mesh: "${child.name}", type=${child.type}, vertices=${(child as THREE.Mesh).geometry.attributes.position.count}`,
            );
          }
        });
        console.log(`[Model] Found ${allMeshes.length} Mesh(es)`);
        for (const mesh of allMeshes) {
          await applyHeightBasedTextures(mesh);
        }

        // デバッグライン（部位境界を可視化）
        fbx.updateMatrixWorld(true);
        const worldBox = new THREE.Box3().setFromObject(fbx);
        const worldH = worldBox.max.y - worldBox.min.y;
        const worldMinY = worldBox.min.y;

        const lineGroup = new THREE.Group();
        const thresholds = [
          {
            frac: REGION_THRESHOLDS.shoeTop,
            color: 0xff0000,
            label: "靴/下半身",
          },
          {
            frac: REGION_THRESHOLDS.bottomTop,
            color: 0x00ff00,
            label: "下半身/上半身",
          },
          {
            frac: REGION_THRESHOLDS.topTop,
            color: 0xffff00,
            label: "上半身/頭",
          },
        ];

        for (const t of thresholds) {
          const y = worldMinY + worldH * t.frac;
          const boxGeo = new THREE.BoxGeometry(1.5, 0.005, 0.005);
          const boxMat = new THREE.MeshBasicMaterial({
            color: t.color,
            depthTest: false,
          });
          const lineMesh = new THREE.Mesh(boxGeo, boxMat);
          lineMesh.position.y = y;
          lineMesh.renderOrder = 999;
          lineGroup.add(lineMesh);
          console.log(`[Debug] ${t.label}: Y=${y.toFixed(3)} (${(t.frac * 100).toFixed(0)}%)`);
        }
        setDebugLines(lineGroup);

        // アニメーション
        mixer.current = new THREE.AnimationMixer(fbx);
        const allClips: THREE.AnimationClip[] = [];

        // 1. Kiss（このFBXに含まれるアニメーション）
        if (fbx.animations.length > 0) {
          const clip = fbx.animations[0];
          clip.name = "Kiss";
          allClips.push(clip);
        }

        // 2. Capoeira（別FBXからアニメーションだけ取得）
        const capoeira = await loadAnimationFromFBX("/models/CapoeiraWithSkin.fbx");
        if (capoeira) {
          capoeira.name = "Capoeira";
          allClips.push(capoeira);
        }

        clips.current = allClips;
        console.log(
          `[Model] ${allClips.length} clips:`,
          allClips.map((c) => c.name),
        );

        if (allClips.length > 0) {
          mixer.current.clipAction(allClips[0]).play();
        }

        setScene(fbx);
      },
      undefined,
      (error) => console.error("FBX load error:", error),
    );

    return () => {
      mixer.current?.stopAllAction();
      mixer.current = null;
    };
  }, []);

  const switchDance = () => {
    if (!mixer.current || clips.current.length <= 1) {
      return;
    }
    mixer.current.stopAllAction();
    currentIndex.current = (currentIndex.current + 1) % clips.current.length;
    const clip = clips.current[currentIndex.current];
    console.log(`Switching to: ${clip.name}`);
    mixer.current.clipAction(clip).reset().play();
  };

  useFrame((_, delta) => {
    mixer.current?.update(delta);
  });

  if (!scene) {
    return null;
  }
  return (
    <>
      <primitive object={scene} onClick={switchDance} />
      {debugLines && <primitive object={debugLines} />}
    </>
  );
};
