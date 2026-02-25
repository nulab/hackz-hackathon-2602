import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export const DancingModel = () => {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const loader = new FBXLoader();

    loader.load(
      "/models/model_sep_HeadTopsBottomsShoes.fbx",
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

        // テクスチャ適用（全パーツ共通のUVリマップ＋テクスチャ貼り付け）
        attachTextureToGroup(fbx, "head", "/models/free_face.png", "#2a1a0a");
        attachTextureToGroup(fbx, "tops", "/models/sozai_tops.png", "#e8a0b8");
        attachBottomsTexture(fbx, "/models/sozai_bottoms_vivid.png");

        setScene(fbx);
      },
      undefined,
      (_error) => {
        // FBX load error
      },
    );
  }, []);

  useFrame((_, delta) => {
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

const attachTextureToGroup = (
  model: THREE.Object3D,
  materialName: string,
  imageUrl: string,
  baseColor = "#ffffff",
) => {
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

  const matIndex = materials.findIndex((m) => m.name === materialName);
  if (matIndex === -1) {
    return;
  }

  const matchingGroups = groups.filter((g) => g.materialIndex === matIndex);
  if (matchingGroups.length === 0) {
    return;
  }

  const uv = mesh.geometry.attributes.uv;
  const pos = mesh.geometry.attributes.position;
  const index = mesh.geometry.index;

  if (materialName === "head") {
    // headは従来のUVリマップ（顔写真にフィット）
    for (const g of matchingGroups) {
      let minU = Infinity,
        maxU = -Infinity,
        minV = Infinity,
        maxV = -Infinity;
      for (let i = g.start; i < g.start + g.count; i++) {
        const vi = index ? index.getX(i) : i;
        minU = Math.min(minU, uv.getX(vi));
        maxU = Math.max(maxU, uv.getX(vi));
        minV = Math.min(minV, uv.getY(vi));
        maxV = Math.max(maxV, uv.getY(vi));
      }
      const rangeU = maxU - minU || 1;
      const rangeV = maxV - minV || 1;
      for (let i = g.start; i < g.start + g.count; i++) {
        const vi = index ? index.getX(i) : i;
        uv.setXY(vi, (uv.getX(vi) - minU) / rangeU, (uv.getY(vi) - minV) / rangeV);
      }
    }

    // 前面/後面フラグ
    const normals = mesh.geometry.attributes.normal;
    const faceFlag = new Float32Array(normals.count);
    for (const g of matchingGroups) {
      for (let i = g.start; i < g.start + g.count; i++) {
        const vi = index ? index.getX(i) : i;
        faceFlag[vi] = normals.getY(vi) < 0 ? 1.0 : 0.0;
      }
    }
    mesh.geometry.setAttribute("faceFlag", new THREE.BufferAttribute(faceFlag, 1));
  } else {
    // head以外: 頂点座標からUVを生成（正面プロジェクション）
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const g of matchingGroups) {
      for (let i = g.start; i < g.start + g.count; i++) {
        const vi = index ? index.getX(i) : i;
        minX = Math.min(minX, pos.getX(vi));
        maxX = Math.max(maxX, pos.getX(vi));
        minZ = Math.min(minZ, pos.getZ(vi));
        maxZ = Math.max(maxZ, pos.getZ(vi));
      }
    }

    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;
    for (const g of matchingGroups) {
      for (let i = g.start; i < g.start + g.count; i++) {
        const vi = index ? index.getX(i) : i;
        const u = (pos.getX(vi) - minX) / rangeX;
        const v = (pos.getZ(vi) - minZ) / rangeZ;
        uv.setXY(vi, u, v);
      }
    }
  }
  uv.needsUpdate = true;

  // テクスチャ読み込み → 衣服部分を切り出し → テクスチャ作成
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(imageUrl, (texture) => {
    const img = texture.image as HTMLImageElement;

    // 画像をCanvasに描画してピクセルデータ取得
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = img.width;
    tmpCanvas.height = img.height;
    const tmpCtx = tmpCanvas.getContext("2d");
    if (!tmpCtx) {
      return;
    }
    tmpCtx.drawImage(img, 0, 0);
    const imageData = tmpCtx.getImageData(0, 0, img.width, img.height);
    const pixels = imageData.data;

    // 不透過ピクセルのバウンディングボックスを検出
    let minX = img.width,
      maxX = 0,
      minY = img.height,
      maxY = 0;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const alpha = pixels[(y * img.width + x) * 4 + 3];
        if (alpha > 10) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    // 切り出した部分でテクスチャ作成
    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    if (materialName === "head") {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, cropW, cropH);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cropW, cropH);
    }
    ctx.drawImage(img, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    const canvasTex = new THREE.CanvasTexture(canvas);

    const mat = new THREE.MeshBasicMaterial({
      map: canvasTex,
      side: THREE.DoubleSide,
    });

    // headの場合: 前面=テクスチャ、後面=髪色のシェーダー
    if (materialName === "head") {
      mat.onBeforeCompile = (shader) => {
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
    }

    // 最新material配列をコピーして更新
    const currentMaterials = Array.isArray(mesh.material) ? [...mesh.material] : [mesh.material];
    currentMaterials[matIndex] = mat;
    mesh.material = currentMaterials;
  });
};

const attachBottomsTexture = (model: THREE.Object3D, imageUrl: string) => {
  const materialName = "bottoms";
  // デニムの基本色（透明部分の埋め色）
  const baseR = 90,
    baseG = 110,
    baseB = 140;

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
  const matIndex = materials.findIndex((m) => m.name === materialName);
  if (matIndex === -1) {
    return;
  }

  const matchingGroups = groups.filter((g) => g.materialIndex === matIndex);
  if (matchingGroups.length === 0) {
    return;
  }

  // 頂点座標からUVを生成（正面プロジェクション）
  const uv = mesh.geometry.attributes.uv;
  const pos = mesh.geometry.attributes.position;
  const index = mesh.geometry.index;

  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const g of matchingGroups) {
    for (let i = g.start; i < g.start + g.count; i++) {
      const vi = index ? index.getX(i) : i;
      minX = Math.min(minX, pos.getX(vi));
      maxX = Math.max(maxX, pos.getX(vi));
      minZ = Math.min(minZ, pos.getZ(vi));
      maxZ = Math.max(maxZ, pos.getZ(vi));
    }
  }
  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;
  for (const g of matchingGroups) {
    for (let i = g.start; i < g.start + g.count; i++) {
      const vi = index ? index.getX(i) : i;
      uv.setXY(vi, (pos.getX(vi) - minX) / rangeX, (pos.getZ(vi) - minZ) / rangeZ);
    }
  }
  uv.needsUpdate = true;

  // テクスチャ読み込み → クロップ + ピクセル単位で処理
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(imageUrl, (texture) => {
    const img = texture.image as HTMLImageElement;

    // 元画像をtmpCanvasに描画してピクセルデータ取得
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = img.width;
    tmpCanvas.height = img.height;
    const tmpCtx = tmpCanvas.getContext("2d");
    if (!tmpCtx) {
      return;
    }
    tmpCtx.drawImage(img, 0, 0);
    const fullData = tmpCtx.getImageData(0, 0, img.width, img.height);
    const fullPx = fullData.data;

    // 不透過ピクセルのバウンディングボックスを検出（クロップ範囲）
    let cMinX = img.width,
      cMaxX = 0,
      cMinY = img.height,
      cMaxY = 0;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (fullPx[(y * img.width + x) * 4 + 3] > 10) {
          cMinX = Math.min(cMinX, x);
          cMaxX = Math.max(cMaxX, x);
          cMinY = Math.min(cMinY, y);
          cMaxY = Math.max(cMaxY, y);
        }
      }
    }
    const cropW = cMaxX - cMinX + 1;
    const cropH = cMaxY - cMinY + 1;

    // クロップ範囲を透明Canvasに描画
    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.drawImage(img, cMinX, cMinY, cropW, cropH, 0, 0, cropW, cropH);

    // ピクセル単位でアルファ処理（RGBは一切触らない）
    const imageData = ctx.getImageData(0, 0, cropW, cropH);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const a = pixels[i + 3];
      if (a > 10) {
        // premultiplied alphaを元に戻してからA=255にする
        const factor = 255 / a;
        pixels[i] = Math.min(255, Math.round(pixels[i] * factor));
        pixels[i + 1] = Math.min(255, Math.round(pixels[i + 1] * factor));
        pixels[i + 2] = Math.min(255, Math.round(pixels[i + 2] * factor));
        pixels[i + 3] = 255;
      } else {
        pixels[i] = baseR;
        pixels[i + 1] = baseG;
        pixels[i + 2] = baseB;
        pixels[i + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    const canvasTex = new THREE.CanvasTexture(canvas);
    canvasTex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: canvasTex,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const currentMaterials = Array.isArray(mesh.material) ? [...mesh.material] : [mesh.material];
    currentMaterials[matIndex] = mat;
    mesh.material = currentMaterials;
  });
};
