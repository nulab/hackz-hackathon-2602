import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export const DancingModel = () => {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);

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
        // attachTextureToGroup(fbx, "shoes", "/models/sozai_shoes.png");

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

  // 全グループ構造をダンプ（初回のみ）
  if (materialName === "head") {
    console.log("=== ALL GROUPS ===");
    groups.forEach((g, i) => {
      const matName = materials[g.materialIndex!]?.name ?? "???";
      console.log(
        `  group[${i}]: start=${g.start}, count=${g.count}, matIndex=${g.materialIndex} (${matName})`,
      );
    });
    console.log(`  total vertex count: ${mesh.geometry.attributes.position.count}`);
    console.log(
      `  materials:`,
      materials.map((m, i) => `${i}:${m.name}`),
    );
  }

  const matIndex = materials.findIndex((m) => m.name === materialName);
  if (matIndex === -1) {
    console.warn(
      `[${materialName}] material not found, available:`,
      materials.map((m) => m.name),
    );
    return;
  }

  // 同じmatIndexのグループが複数あるかチェック
  const matchingGroups = groups.filter((g) => g.materialIndex === matIndex);
  console.log(
    `[${materialName}] matching groups: ${matchingGroups.length}`,
    matchingGroups.map((g) => `start=${g.start},count=${g.count}`),
  );

  if (matchingGroups.length === 0) {
    console.warn(`[${materialName}] no groups found for matIndex=${matIndex}`);
    return;
  }

  const uv = mesh.geometry.attributes.uv;
  const pos = mesh.geometry.attributes.position;
  const index = mesh.geometry.index;
  const totalVerts = matchingGroups.reduce((sum, g) => sum + g.count, 0);

  if (materialName === "head") {
    // headは従来のUVリマップ（最初のグループのみ、顔写真にフィット）
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
    // モデル空間: X=左右, Y=前後, Z=上下（Blender Z-up）
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
    console.log(
      `[${materialName}] position range: X[${minX.toFixed(3)}, ${maxX.toFixed(3)}] Z[${minZ.toFixed(3)}, ${maxZ.toFixed(3)}]`,
    );

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
  console.log(
    `[${materialName}] ${materialName === "head" ? "UV remapped" : "position projected"}: ${matchingGroups.length} groups, ${totalVerts} verts`,
  );

  // テクスチャ読み込み → 衣服部分を切り出し → タイルテクスチャ作成
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(imageUrl, (texture) => {
    const img = texture.image as HTMLImageElement;
    console.log(`[${materialName}] texture loaded: ${img.width}x${img.height}`);

    // 1. 画像をCanvasに描画してピクセルデータ取得
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = img.width;
    tmpCanvas.height = img.height;
    const tmpCtx = tmpCanvas.getContext("2d")!;
    tmpCtx.drawImage(img, 0, 0);
    const imageData = tmpCtx.getImageData(0, 0, img.width, img.height);
    const pixels = imageData.data;

    // 2. 不透過ピクセルのバウンディングボックスを検出
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
    console.log(
      `[${materialName}] content bounds: (${minX},${minY})-(${maxX},${maxY}) = ${cropW}x${cropH}`,
    );

    // 3. 切り出した衣服部分でテクスチャ作成（彩度・コントラスト強調）
    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d")!;
    if (materialName === "head") {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, cropW, cropH);
    } else {
      // 白背景で透明部分を埋める（画像はそのまま加工なし）
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

    // callback時点の最新material配列をコピーして更新
    const currentMaterials = Array.isArray(mesh.material) ? [...mesh.material] : [mesh.material];
    currentMaterials[matIndex] = mat;
    mesh.material = currentMaterials;

    console.log(
      `[${materialName}] material set at index ${matIndex}, total: ${currentMaterials.length}`,
    );
    console.log(
      `[${materialName}] all materials:`,
      currentMaterials.map((m, i) => `${i}:${m.type}`),
    );
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
    const tmpCtx = tmpCanvas.getContext("2d")!;
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
    const ctx = canvas.getContext("2d")!;
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
    console.log(`[${materialName}] material set (pixel-level processing)`);
  });
};

const findBone = (model: THREE.Object3D, name: string): THREE.Bone | null => {
  let found: THREE.Bone | null = null;
  model.traverse((child) => {
    if ((child as THREE.Bone).isBone && child.name === name) {
      found = child as THREE.Bone;
    }
  });
  return found;
};

const createDanceClip = (model: THREE.Object3D): THREE.AnimationClip | null => {
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
};
