# Projector 3D Viewer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** projector アプリに `/viewer` ルートを追加し、NFC スキャンしたアクティブユーザーの 3D コスチュームモデルを React Three Fiber で全画面表示する。

**Architecture:** サーバーにインメモリ ActiveUserStore を追加し、専用 tRPC router で CRUD。projector フロントエンドは 2 秒間隔でポーリングし、ユーザー変更時にモデルのテクスチャとアニメーションを切り替える。

**Tech Stack:** React Three Fiber, Three.js FBXLoader, tRPC, Hono, Bun monorepo, Tailwind CSS 4

---

### Task 1: ActiveUserStore (server)

**Files:**

- Create: `packages/server/src/active-user-store.ts`
- Test: `packages/server/src/active-user-store.test.ts`

**Step 1: Write the test**

```typescript
// packages/server/src/active-user-store.test.ts
import { describe, test, expect, beforeEach } from "bun:test";
import { ActiveUserStore } from "./active-user-store";

describe("ActiveUserStore", () => {
  let store: ActiveUserStore;

  beforeEach(() => {
    store = new ActiveUserStore();
  });

  test("get returns null initially", () => {
    expect(store.get()).toBeNull();
  });

  test("set and get returns the active user", () => {
    store.set("user-1", "nfc-abc");
    const result = store.get();
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-1");
    expect(result!.nfcId).toBe("nfc-abc");
    expect(result!.updatedAt).toBeGreaterThan(0);
  });

  test("set overwrites the previous user", () => {
    store.set("user-1", "nfc-abc");
    store.set("user-2", "nfc-def");
    expect(store.get()!.userId).toBe("user-2");
  });

  test("clear resets to null", () => {
    store.set("user-1", "nfc-abc");
    store.clear();
    expect(store.get()).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && bun test src/active-user-store.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// packages/server/src/active-user-store.ts
type ActiveUser = {
  userId: string;
  nfcId: string;
  updatedAt: number;
};

export class ActiveUserStore {
  private activeUser: ActiveUser | null = null;

  set(userId: string, nfcId: string): void {
    this.activeUser = { userId, nfcId, updatedAt: Date.now() };
  }

  get(): ActiveUser | null {
    return this.activeUser;
  }

  clear(): void {
    this.activeUser = null;
  }
}

export const activeUserStore = new ActiveUserStore();
```

**Step 4: Run test to verify it passes**

Run: `cd packages/server && bun test src/active-user-store.test.ts`
Expected: PASS (4/4)

**Step 5: Commit**

```bash
git add packages/server/src/active-user-store.ts packages/server/src/active-user-store.test.ts
git commit -m "feat: add ActiveUserStore for projector viewer"
```

---

### Task 2: Shared schemas for projector viewer

**Files:**

- Modify: `packages/shared/src/schemas.ts` (append at end, before closing)

**Step 1: Add schemas**

Append the following to `packages/shared/src/schemas.ts`:

```typescript
// === Projector Viewer Schemas ===

export const activeUserOutputSchema = z.object({
  user: z
    .object({
      id: z.string(),
      name: z.string(),
      photoUrl: z.string().optional(),
    })
    .nullable(),
  build: z
    .object({
      faceId: z.string().optional(),
      upperId: z.string().optional(),
      lowerId: z.string().optional(),
      shoesId: z.string().optional(),
    })
    .nullable(),
});

export const setActiveUserInputSchema = z.object({
  nfcId: z.string().min(1),
});
```

**Step 2: Verify build**

Run: `cd packages/shared && bunx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/shared/src/schemas.ts
git commit -m "feat: add projector viewer schemas to shared package"
```

---

### Task 3: tRPC projectorViewer router

**Files:**

- Create: `packages/server/src/trpc/routers/projector-viewer.ts`
- Modify: `packages/server/src/trpc/routers/_app.ts`

**Step 1: Create the router**

```typescript
// packages/server/src/trpc/routers/projector-viewer.ts
import { z } from "zod";
import { activeUserOutputSchema, setActiveUserInputSchema } from "@hackz/shared";
import { publicProcedure, router } from "../trpc";
import { activeUserStore } from "../../active-user-store";
import { createDynamoDBUserRepository } from "../../repositories/dynamodb/user-repository";
import { createDynamoDBCostumeBuildRepository } from "../../repositories/dynamodb/costume-build-repository";

const userRepo = createDynamoDBUserRepository();
const buildRepo = createDynamoDBCostumeBuildRepository();

export const projectorViewerRouter = router({
  getActiveUser: publicProcedure.output(activeUserOutputSchema).query(async () => {
    const active = activeUserStore.get();
    if (!active) {
      return { user: null, build: null };
    }

    const user = await userRepo.findById(active.userId);
    if (!user) {
      return { user: null, build: null };
    }

    const build = await buildRepo.find(active.userId, "default");

    return {
      user: {
        id: user.id,
        name: user.name,
        photoUrl: user.photoUrl,
      },
      build: build
        ? {
            faceId: build.faceId,
            upperId: build.upperId,
            lowerId: build.lowerId,
            shoesId: build.shoesId,
          }
        : null,
    };
  }),

  setActiveUser: publicProcedure
    .input(setActiveUserInputSchema)
    .output(z.object({ success: z.boolean(), userId: z.string().nullable() }))
    .mutation(async ({ input }) => {
      const user = await userRepo.findByNfcId(input.nfcId);
      if (!user) {
        return { success: false, userId: null };
      }
      activeUserStore.set(user.id, input.nfcId);
      return { success: true, userId: user.id };
    }),

  clearActiveUser: publicProcedure.output(z.object({ success: z.boolean() })).mutation(() => {
    activeUserStore.clear();
    return { success: true };
  }),
});
```

**Step 2: Register in app router**

In `packages/server/src/trpc/routers/_app.ts`, add import and register:

```typescript
import { router } from "../trpc";
import { authRouter } from "./auth";
import { usersRouter } from "./users";
import { gachaRouter } from "./gacha";
import { costumesRouter } from "./costumes";
import { sessionsRouter } from "./sessions";
import { synthesisRouter } from "./synthesis";
import { roomRouter } from "./room";
import { projectorViewerRouter } from "./projector-viewer";

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  gacha: gachaRouter,
  costumes: costumesRouter,
  sessions: sessionsRouter,
  synthesis: synthesisRouter,
  room: roomRouter,
  projectorViewer: projectorViewerRouter,
});

export type AppRouter = typeof appRouter;
```

**Step 3: Verify build**

Run: `bun run build`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/server/src/trpc/routers/projector-viewer.ts packages/server/src/trpc/routers/_app.ts
git commit -m "feat: add projectorViewer tRPC router with getActiveUser/setActiveUser/clearActiveUser"
```

---

### Task 4: Install R3F dependencies in projector

**Files:**

- Modify: `apps/projector/package.json`

**Step 1: Install packages**

```bash
cd apps/projector && bun add three @react-three/fiber @react-three/drei && bun add -d @types/three
```

**Step 2: Verify install**

Run: `bun install` (from root)
Expected: lockfile updated, no errors

**Step 3: Commit**

```bash
git add apps/projector/package.json bun.lock
git commit -m "feat: add Three.js and React Three Fiber dependencies to projector"
```

---

### Task 5: Animation list and texture resolver

**Files:**

- Create: `apps/projector/src/lib/animation-list.ts`
- Create: `apps/projector/src/lib/texture-resolver.ts`

**Step 1: Create animation list**

```typescript
// apps/projector/src/lib/animation-list.ts
export const ANIMATION_PATHS = [
  "/models/standing_idol.fbx",
  // Mixamo FBX files — add paths here as you download them:
  // "/models/animations/dance_01.fbx",
  // "/models/animations/wave.fbx",
];
```

**Step 2: Create texture resolver**

```typescript
// apps/projector/src/lib/texture-resolver.ts
type BuildTextures = {
  face: string;
  tops: string;
  bottoms: string;
  shoes: string;
};

const DEFAULTS: BuildTextures = {
  face: "/models/free_face.png",
  tops: "/models/sozai_tops.png",
  bottoms: "/models/sozai_bottoms_vivid.png",
  shoes: "/models/sozai_shoes.png",
};

export const resolveTextures = (photoUrl?: string): BuildTextures => ({
  face: photoUrl || DEFAULTS.face,
  tops: DEFAULTS.tops,
  bottoms: DEFAULTS.bottoms,
  shoes: DEFAULTS.shoes,
});
```

**Step 3: Commit**

```bash
git add apps/projector/src/lib/animation-list.ts apps/projector/src/lib/texture-resolver.ts
git commit -m "feat: add animation list and texture resolver for projector viewer"
```

---

### Task 6: FullscreenButton component

**Files:**

- Create: `apps/projector/src/components/viewer/FullscreenButton.tsx`

**Step 1: Create the component**

```tsx
// apps/projector/src/components/viewer/FullscreenButton.tsx
import { useCallback, useEffect, useState } from "react";

export const FullscreenButton = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
      title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    >
      {isFullscreen ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
        </svg>
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      )}
    </button>
  );
};
```

**Step 2: Commit**

```bash
git add apps/projector/src/components/viewer/FullscreenButton.tsx
git commit -m "feat: add FullscreenButton component for projector viewer"
```

---

### Task 7: IdleScreen component

**Files:**

- Create: `apps/projector/src/components/viewer/IdleScreen.tsx`

**Step 1: Create the component**

```tsx
// apps/projector/src/components/viewer/IdleScreen.tsx
export const IdleScreen = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
    <div className="animate-pulse flex flex-col items-center gap-4">
      <svg
        className="w-16 h-16 text-white/30"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5"
        />
      </svg>
      <p className="text-white/30 text-2xl font-bold">NFC をスキャンしてね</p>
    </div>
  </div>
);
```

**Step 2: Commit**

```bash
git add apps/projector/src/components/viewer/IdleScreen.tsx
git commit -m "feat: add IdleScreen component for projector viewer"
```

---

### Task 8: CharacterModel component (R3F + custom shader)

This is the core 3D component. Port the mobile DancingModel logic to R3F declarative style.

**Files:**

- Create: `apps/projector/src/components/viewer/CharacterModel.tsx`

**Step 1: Create the component**

```tsx
// apps/projector/src/components/viewer/CharacterModel.tsx
import { useRef, useEffect, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { ANIMATION_PATHS } from "../../lib/animation-list";

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

const applyHeightBasedTextures = async (mesh: THREE.Mesh, faceUrl: string) => {
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
    if (z < shoeTop) r = 0;
    else if (z < bottomTop) r = 1;
    else if (z < topTop) r = 2;
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
    loadProcessedTexture("/models/sozai_tops.png"),
    loadProcessedTexture("/models/sozai_bottoms_vivid.png"),
    loadProcessedTexture("/models/sozai_shoes.png"),
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

  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map(() => mat);
  } else {
    mesh.material = mat;
  }
};

// --- Pick a random animation, different from current ---
const pickRandomAnimation = (current: number): number => {
  if (ANIMATION_PATHS.length <= 1) return 0;
  let next: number;
  do {
    next = Math.floor(Math.random() * ANIMATION_PATHS.length);
  } while (next === current && ANIMATION_PATHS.length > 1);
  return next;
};

type CharacterModelProps = {
  faceImageUrl?: string | null;
};

export const CharacterModel = ({ faceImageUrl }: CharacterModelProps) => {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const currentAnimIndex = useRef(-1);
  const fbxRef = useRef<THREE.Group | null>(null);

  const playRandomAnimation = useCallback(async () => {
    if (!fbxRef.current || !mixer.current) return;
    const idx = pickRandomAnimation(currentAnimIndex.current);
    currentAnimIndex.current = idx;
    const clip = await loadAnimationFromFBX(ANIMATION_PATHS[idx]);
    if (!clip || !mixer.current) return;

    const prevActions = mixer.current._actions?.slice() ?? [];
    const action = mixer.current.clipAction(clip);
    action.reset().play();

    // Crossfade from previous
    for (const prev of prevActions) {
      prev.crossFadeTo(action, 0.5, false);
    }

    // When this animation finishes, play another
    const onFinished = () => {
      mixer.current?.removeEventListener("finished", onFinished);
      playRandomAnimation();
    };
    action.clampWhenFinished = false;
    action.loop = THREE.LoopRepeat;
    // Switch animation every 10-20 seconds
    const duration = 10000 + Math.random() * 10000;
    setTimeout(() => {
      if (currentAnimIndex.current === idx) {
        playRandomAnimation();
      }
    }, duration);
  }, []);

  useEffect(() => {
    const loader = new FBXLoader();
    loader.load("/models/KissWithSkin.fbx", async (fbx) => {
      fbx.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Scale to 1.5m
      const box = new THREE.Box3().setFromObject(fbx);
      const size = box.getSize(new THREE.Vector3());
      fbx.scale.setScalar(1.5 / size.y);
      fbx.updateMatrixWorld(true);
      const adj = new THREE.Box3().setFromObject(fbx);
      fbx.position.y = -adj.min.y;

      setScene(fbx);
      fbxRef.current = fbx;

      // Apply textures
      const headUrl = faceImageUrl || "/models/free_face.png";
      const allMeshes: THREE.Mesh[] = [];
      fbx.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) allMeshes.push(child as THREE.Mesh);
      });
      for (const mesh of allMeshes) {
        await applyHeightBasedTextures(mesh, headUrl);
      }

      // Start animation
      mixer.current = new THREE.AnimationMixer(fbx);
      playRandomAnimation();
    });

    return () => {
      mixer.current?.stopAllAction();
      mixer.current = null;
      fbxRef.current = null;
    };
  }, [faceImageUrl, playRandomAnimation]);

  useFrame((_, delta) => {
    mixer.current?.update(delta);
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  if (!scene) return null;
  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
};
```

**Step 2: Verify no TypeScript errors**

Run: `cd apps/projector && bunx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/projector/src/components/viewer/CharacterModel.tsx
git commit -m "feat: add CharacterModel with height-based shader and random animation"
```

---

### Task 9: Viewer route page

**Files:**

- Create: `apps/projector/src/routes/viewer.tsx`

**Step 1: Create the route**

```tsx
// apps/projector/src/routes/viewer.tsx
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
  const textures = resolveTextures(user?.photoUrl);

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
        {user && <CharacterModel faceImageUrl={textures.face} />}
      </Canvas>
    </div>
  );
};

export const Route = createFileRoute("/viewer")({
  component: ViewerPage,
});
```

**Step 2: Update root route to allow fullscreen Canvas**

In `apps/projector/src/routes/__root.tsx`, remove the `aspect-video max-h-screen` constraint wrapper so `/viewer` can be truly fullscreen. The root should remain flexible:

```tsx
// apps/projector/src/routes/__root.tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TRPCProvider } from "../lib/trpc-provider";

export const Route = createRootRoute({
  component: () => (
    <TRPCProvider>
      <Outlet />
    </TRPCProvider>
  ),
});
```

Note: This removes the outer div styling from the root. The existing `/` and `/pair` routes already have their own full-screen styling (`h-screen bg-gray-900` etc.), so they won't be affected.

**Step 3: Verify dev server starts**

Run: `cd apps/projector && bun run dev`
Expected: Vite dev server starts, `/viewer` route is accessible

**Step 4: Commit**

```bash
git add apps/projector/src/routes/viewer.tsx apps/projector/src/routes/__root.tsx
git commit -m "feat: add /viewer route with fullscreen 3D character display"
```

---

### Task 10: Integration — call setActiveUser from projector index

When the existing projector index page receives an NFC scan and looks up a user, also call `setActiveUser` so the viewer can pick it up.

**Files:**

- Modify: `apps/projector/src/routes/index.tsx`

**Step 1: Add setActiveUser mutation call**

In the `processNfc` function (around line 71-117), after a successful user lookup (`result.found && result.user`), add a call to `projectorViewer.setActiveUser`:

Add mutation hook near other hooks (around line 59):

```typescript
const setActiveUserMutation = trpc.projectorViewer.setActiveUser.useMutation();
const setActiveRef = useRef(setActiveUserMutation.mutate);
setActiveRef.current = setActiveUserMutation.mutate;
```

Then inside `processNfc`, right after `setDisplay({ type: "found", user: result.user });` (line 83), add:

```typescript
setActiveRef.current({ nfcId });
```

**Step 2: Verify dev server and NFC flow**

Run: `bun run dev` — verify both `/` and `/viewer` routes work.

**Step 3: Commit**

```bash
git add apps/projector/src/routes/index.tsx
git commit -m "feat: call setActiveUser on NFC scan for projector viewer integration"
```

---

### Task 11: Create animations directory and placeholder

**Files:**

- Create: `apps/projector/public/models/animations/.gitkeep`

**Step 1: Create directory**

```bash
mkdir -p apps/projector/public/models/animations
touch apps/projector/public/models/animations/.gitkeep
```

**Step 2: Commit**

```bash
git add apps/projector/public/models/animations/.gitkeep
git commit -m "feat: add animations directory for Mixamo FBX files"
```

---

### Task 12: Copy model assets from mobile to projector

The projector needs the same FBX model and texture files as mobile.

**Step 1: Copy files**

```bash
cp apps/mobile/public/models/KissWithSkin.fbx apps/projector/public/models/
cp apps/mobile/public/models/standing_idol.fbx apps/projector/public/models/
cp apps/mobile/public/models/free_face.png apps/projector/public/models/
cp apps/mobile/public/models/sozai_tops.png apps/projector/public/models/
cp apps/mobile/public/models/sozai_bottoms_vivid.png apps/projector/public/models/
cp apps/mobile/public/models/sozai_shoes.png apps/projector/public/models/
```

**Step 2: Verify files exist**

```bash
ls -la apps/projector/public/models/
```

**Step 3: Commit**

```bash
git add apps/projector/public/models/
git commit -m "feat: copy 3D model and texture assets to projector app"
```

---

### Task 13: Final verification

**Step 1: Run lint**

```bash
bun run lint
```

**Step 2: Run format**

```bash
bun run format:fix
```

**Step 3: Run build**

```bash
bun run build
```

**Step 4: Run tests**

```bash
bun test
```

**Step 5: Manual smoke test**

1. `bun run dev`
2. Open projector `/viewer` — should show idle screen
3. Open projector `/` — should show QR code
4. Scan NFC via admin → user should appear on `/` and also become active for `/viewer`
5. `/viewer` should show 3D model with textures and animation
6. Click fullscreen button → canvas goes fullscreen
7. ESC → exits fullscreen

**Step 6: Final commit if format changes**

```bash
git add -A
git commit -m "chore: format and lint fixes"
```
