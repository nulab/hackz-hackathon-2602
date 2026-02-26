import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

// animations/ ディレクトリの Mixamo FBX ファイル
const ANIMATION_URLS = [
  "/models/animations/Breakdance Freeze Var 4.fbx",
  "/models/animations/Ginga Variation 3.fbx",
  "/models/animations/Wave Hip Hop Dance.fbx",
];

// --- Mixamo FBX からアニメーションだけ取り出す ---
const loadAnimationFromFBX = (url: string): Promise<THREE.AnimationClip | null> =>
  new Promise((resolve) => {
    new FBXLoader().load(
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
    new THREE.TextureLoader().load(url, (texture) => {
      const img = texture.image as HTMLImageElement;
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = img.width;
      tmpCanvas.height = img.height;
      const tmpCtx = tmpCanvas.getContext("2d")!;
      tmpCtx.drawImage(img, 0, 0);
      const imageData = tmpCtx.getImageData(0, 0, img.width, img.height);
      const pixels = imageData.data;

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
      ctx.fillStyle = opts.bgColor ?? `rgb(${fillRGB[0]},${fillRGB[1]},${fillRGB[2]})`;
      ctx.fillRect(0, 0, cropW, cropH);
      ctx.drawImage(img, cMinX, cMinY, cropW, cropH, 0, 0, cropW, cropH);

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

const REGION_THRESHOLDS = { shoeTop: 0.03, bottomTop: 0.6, topTop: 0.87 };

const applyHeightBasedTextures = async (
  mesh: THREE.Mesh,
  faceUrl: string,
  topsUrl?: string,
  bottomsUrl?: string,
  shoesUrl?: string,
) => {
  const geometry = mesh.geometry;
  const pos = geometry.attributes.position;

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
    bodyRegion[i] = region;
    regionUV[i * 2] = (x - rr.minX) / (rr.maxX - rr.minX || 1);
    regionUV[i * 2 + 1] = localV;
  }

  geometry.setAttribute("bodyRegion", new THREE.BufferAttribute(bodyRegion, 1));
  geometry.setAttribute("regionUV", new THREE.BufferAttribute(regionUV, 2));

  const [headTex, topsTex, bottomsTex, shoesTex] = await Promise.all([
    loadProcessedTexture(faceUrl, { bgColor: "#2a1a0a" }),
    loadProcessedTexture(topsUrl || "/models/sozai_tops.png"),
    loadProcessedTexture(bottomsUrl || "/models/sozai_bottoms_vivid.png"),
    loadProcessedTexture(shoesUrl || "/models/sozai_shoes.png"),
  ]);

  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
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

const pickRandomAnimationUrl = () =>
  ANIMATION_URLS[Math.floor(Math.random() * ANIMATION_URLS.length)];

type CharacterModelProps = {
  faceImageUrl?: string | null;
  topsUrl?: string;
  bottomsUrl?: string;
  shoesUrl?: string;
};

export const CharacterModel = ({
  faceImageUrl,
  topsUrl,
  bottomsUrl,
  shoesUrl,
}: CharacterModelProps) => {
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

      const box = new THREE.Box3().setFromObject(fbx);
      const size = box.getSize(new THREE.Vector3());
      fbx.scale.setScalar(1.5 / size.y);
      fbx.updateMatrixWorld(true);
      const adj = new THREE.Box3().setFromObject(fbx);
      fbx.position.y = -adj.min.y;

      setScene(fbx);

      const headUrl = faceImageUrl || "/models/free_face.png";
      const allMeshes: THREE.Mesh[] = [];
      fbx.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          allMeshes.push(child as THREE.Mesh);
        }
      });
      for (const mesh of allMeshes) {
        await applyHeightBasedTextures(mesh, headUrl, topsUrl, bottomsUrl, shoesUrl);
      }

      mixer.current = new THREE.AnimationMixer(fbx);
      const clip = await loadAnimationFromFBX(pickRandomAnimationUrl());
      if (clip && mixer.current) {
        const action = mixer.current.clipAction(clip);
        action.loop = THREE.LoopRepeat;
        action.play();
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
