# Mobile App Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Astro製モバイルアプリを React (TanStack Router) に移植し、同等のUI・機能を実現する

**Architecture:** ソースCSSをそのまま持ち込み、Astroコンポーネントを React コンポーネントに変換。localStorage ベースのスタブAPIを維持。TanStack Router のファイルベースルーティングで `/u/$userId`, `/u/$userId/gacha/$costumeKey`, `/u/$userId/costumes` の3ルートを構成。

**Tech Stack:** React 19, TanStack Router, Vite, CSS (source CSS layers), localStorage

---

### Task 1: Copy image assets

**Files:**

- Copy: all 39 PNGs from source `public/images/` → `apps/mobile/src/assets/images/`

**Step 1: Copy all image files**

```bash
mkdir -p apps/mobile/src/assets/images
cp /Users/ryoya.tamura/ghq/simochee.git.backlog.com/HACKZ_NULAB_26/mobile-app/public/images/*.png apps/mobile/src/assets/images/
```

**Step 2: Create image index for ES imports**

Create `apps/mobile/src/assets/images/index.ts`:

```ts
// UI assets
import logo from "./logo.png";
import button from "./button.png";
import magiccircle from "./magiccircle.png";
import defaultChar from "./default.png";
import heart from "./heart.png";
import star from "./star.png";
import cardBack from "./card_back.png";
import cardBackSsr from "./card_back_ssr.png";

// Card images
import cardOfficeFace from "./card_office-face.png";
import cardOfficeUpper from "./card_office-upper.png";
import cardOfficeLower from "./card_office-lower.png";
import cardOfficeShoes from "./card_office-shoes.png";
import cardPrincessFace from "./card_princess-face.png";
import cardPrincessUpper from "./card_princess-upper.png";
import cardPrincessLower from "./card_princess-lower.png";
import cardPrincessShoes from "./card_princess-shoes.png";
import cardGalFace from "./card_gal-face.png";
import cardGalUpper from "./card_gal-upper.png";
import cardGalLower from "./card_gal-lower.png";
import cardGalShoes from "./card_gal-shoes.png";
import cardSsrFace from "./card_ssr-face.png";
import cardSsrUpper from "./card_ssr-upper.png";
import cardSsrLower from "./card_ssr-lower.png";
import cardSsrShoes from "./card_ssr-shoes.png";

// Item images
import itemOfficeFace from "./item_office-face.png";
import itemOfficeUpper from "./item_office-upper.png";
import itemOfficeLower from "./item_office-lower.png";
import itemOfficeShoes from "./item_office-shoes.png";
import itemPrincessFace from "./item_princess-face.png";
import itemPrincessUpper from "./item_princess-upper.png";
import itemPrincessLower from "./item_princess-lower.png";
import itemPrincessShoes from "./item_princess-shoes.png";
import itemGalFace from "./item_gal-face.png";
import itemGalUpper from "./item_gal-upper.png";
import itemGalLower from "./item_gal-lower.png";
import itemGalShoes from "./item_gal-shoes.png";
import itemSsrFace from "./item_ssr-face.png";
import itemSsrUpper from "./item_ssr-upper.png";
import itemSsrLower from "./item_ssr-lower.png";
import itemSsrShoes from "./item_ssr-shoes.png";

export const uiImages = {
  logo,
  button,
  magiccircle,
  defaultChar,
  heart,
  star,
  cardBack,
  cardBackSsr,
};

export const cardImages: Record<string, string> = {
  "office-face": cardOfficeFace,
  "office-upper": cardOfficeUpper,
  "office-lower": cardOfficeLower,
  "office-shoes": cardOfficeShoes,
  "princess-face": cardPrincessFace,
  "princess-upper": cardPrincessUpper,
  "princess-lower": cardPrincessLower,
  "princess-shoes": cardPrincessShoes,
  "gal-face": cardGalFace,
  "gal-upper": cardGalUpper,
  "gal-lower": cardGalLower,
  "gal-shoes": cardGalShoes,
  "ssr-face": cardSsrFace,
  "ssr-upper": cardSsrUpper,
  "ssr-lower": cardSsrLower,
  "ssr-shoes": cardSsrShoes,
};

export const itemImages: Record<string, string> = {
  "office-face": itemOfficeFace,
  "office-upper": itemOfficeUpper,
  "office-lower": itemOfficeLower,
  "office-shoes": itemOfficeShoes,
  "princess-face": itemPrincessFace,
  "princess-upper": itemPrincessUpper,
  "princess-lower": itemPrincessLower,
  "princess-shoes": itemPrincessShoes,
  "gal-face": itemGalFace,
  "gal-upper": itemGalUpper,
  "gal-lower": itemGalLower,
  "gal-shoes": itemGalShoes,
  "ssr-face": itemSsrFace,
  "ssr-upper": itemSsrUpper,
  "ssr-lower": itemSsrLower,
  "ssr-shoes": itemSsrShoes,
};
```

**Step 3: Commit**

```bash
git add apps/mobile/src/assets/
git commit -m "feat(mobile): add image assets with ES import index"
```

---

### Task 2: Copy CSS files

**Files:**

- Create: `apps/mobile/src/styles/tokens.css`
- Create: `apps/mobile/src/styles/reset.css`
- Create: `apps/mobile/src/styles/base.css`
- Create: `apps/mobile/src/styles/layout.css`
- Create: `apps/mobile/src/styles/utilities.css`
- Create: `apps/mobile/src/styles/global.css`
- Modify: `apps/mobile/src/index.css`

**Step 1: Copy all CSS files from source**

```bash
mkdir -p apps/mobile/src/styles
cp /Users/ryoya.tamura/ghq/simochee.git.backlog.com/HACKZ_NULAB_26/mobile-app/src/styles/*.css apps/mobile/src/styles/
```

**Step 2: Update `apps/mobile/src/index.css`**

Replace content with:

```css
@import "tailwindcss";
@import "./styles/global.css";
```

**Step 3: Commit**

```bash
git add apps/mobile/src/styles/ apps/mobile/src/index.css
git commit -m "feat(mobile): add source CSS files (tokens, reset, base, layout, utilities)"
```

---

### Task 3: Create lib files (items, storage, api)

**Files:**

- Create: `apps/mobile/src/lib/items.ts`
- Create: `apps/mobile/src/lib/storage.ts`
- Create: `apps/mobile/src/lib/api.ts`

**Step 1: Create items.ts**

Copy from source but update image references to use the import map:

```ts
export type ItemRarity = "R" | "SSR";
export type ItemLayer = "face" | "upper" | "lower" | "shoes";

export type Item = {
  id: string;
  no: number;
  name: string;
  rarity: ItemRarity;
  layer: ItemLayer;
};

export const ITEMS: Item[] = [
  { id: "office-face", no: 1, name: "くろぶちメガネ", rarity: "R", layer: "face" },
  { id: "office-upper", no: 2, name: "へそだしTシャツ", rarity: "R", layer: "upper" },
  { id: "office-lower", no: 3, name: "あかいズボン", rarity: "R", layer: "lower" },
  { id: "office-shoes", no: 4, name: "くろいスニーカー", rarity: "R", layer: "shoes" },
  { id: "princess-face", no: 5, name: "はっぱのかんむり", rarity: "R", layer: "face" },
  { id: "princess-upper", no: 6, name: "ドレス（うえ）", rarity: "R", layer: "upper" },
  { id: "princess-lower", no: 7, name: "ドレス（した）", rarity: "R", layer: "lower" },
  { id: "princess-shoes", no: 8, name: "ガラスのヒール", rarity: "R", layer: "shoes" },
  { id: "gal-face", no: 9, name: "ギャルサングラス", rarity: "R", layer: "face" },
  { id: "gal-upper", no: 10, name: "ギャルロンT", rarity: "R", layer: "upper" },
  { id: "gal-lower", no: 11, name: "ギャルデニム", rarity: "R", layer: "lower" },
  { id: "gal-shoes", no: 12, name: "ギャルスニーカー", rarity: "R", layer: "shoes" },
  { id: "ssr-face", no: 13, name: "すごいヘッドホン", rarity: "SSR", layer: "face" },
  { id: "ssr-upper", no: 14, name: "すごいトップス", rarity: "SSR", layer: "upper" },
  { id: "ssr-lower", no: 15, name: "すごいスカート", rarity: "SSR", layer: "lower" },
  { id: "ssr-shoes", no: 16, name: "すごいハイヒール", rarity: "SSR", layer: "shoes" },
];
```

Note: `image` field removed — use `itemImages[id]` / `cardImages[id]` from assets index instead.

**Step 2: Create storage.ts**

Copy from source as-is (already TypeScript compatible):

```ts
export interface InventoryItem {
  count: number;
}

export type InventoryMap = Record<string, InventoryItem>;

const STORAGE_KEYS = {
  INVENTORY: "inventoryMap",
  SELECTED_ITEMS: "selectedItemIds",
  PHOTO: "photo",
} as const;

export const storage = {
  getInventory(): InventoryMap {
    const stored = localStorage.getItem(STORAGE_KEYS.INVENTORY);
    return stored ? JSON.parse(stored) : {};
  },
  saveInventory(inventory: InventoryMap): void {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
  },
  getSelectedItems(): string[] {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_ITEMS);
    return stored ? JSON.parse(stored) : [];
  },
  saveSelectedItems(itemIds: string[]): void {
    localStorage.setItem(STORAGE_KEYS.SELECTED_ITEMS, JSON.stringify(itemIds));
  },
  getPhoto(): string | null {
    return localStorage.getItem(STORAGE_KEYS.PHOTO);
  },
  savePhoto(dataURL: string): void {
    localStorage.setItem(STORAGE_KEYS.PHOTO, dataURL);
  },
};
```

Note: SSR guards (`typeof window === 'undefined'`) removed — React SPA doesn't need them.

**Step 3: Create api.ts**

```ts
import { ITEMS, type Item } from "./items";
import { storage, type InventoryMap } from "./storage";

export function drawGacha(): Item {
  const randomIndex = Math.floor(Math.random() * ITEMS.length);
  return ITEMS[randomIndex];
}

export function getInventory(): InventoryMap {
  return storage.getInventory();
}

export function addToInventory(itemId: string): void {
  const inventory = storage.getInventory();
  if (inventory[itemId]) {
    inventory[itemId].count += 1;
  } else {
    inventory[itemId] = { count: 1 };
  }
  storage.saveInventory(inventory);
}

export function saveSelection(itemIds: string[]): void {
  storage.saveSelectedItems(itemIds);
}

export function getSelectedItems(): Item[] {
  const selectedIds = storage.getSelectedItems();
  return selectedIds
    .map((id) => ITEMS.find((item) => item.id === id))
    .filter((item): item is Item => item !== undefined);
}
```

Note: Made synchronous (no need for async stubs in localStorage-only impl).

**Step 4: Commit**

```bash
git add apps/mobile/src/lib/items.ts apps/mobile/src/lib/storage.ts apps/mobile/src/lib/api.ts
git commit -m "feat(mobile): add lib files (items, storage, api)"
```

---

### Task 4: Create Toast component and context

**Files:**

- Create: `apps/mobile/src/components/Toast.tsx`

**Step 1: Create React Toast with context**

```tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastType = "info" | "success" | "error";

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean } | null>(
    null,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 3000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type, visible: true });
    timerRef.current = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: false } : null));
      setTimeout(() => setToast(null), 300);
    }, duration);
  }, []);

  return (
    <ToastContext value={{ showToast }}>
      {children}
      {toast && (
        <div className="toast-container">
          <div
            className={`toast toast-${toast.type} ${toast.visible ? "toast-show" : "toast-hide"}`}
          >
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext>
  );
}
```

**Step 2: Commit**

```bash
git add apps/mobile/src/components/Toast.tsx
git commit -m "feat(mobile): add Toast component with React context"
```

---

### Task 5: Create FallingItems component

**Files:**

- Create: `apps/mobile/src/components/FallingItems.tsx`

**Step 1: Create component**

```tsx
import { useEffect, useRef } from "react";
import { uiImages } from "../assets/images";
import styles from "./FallingItems.module.css";

export function FallingItems() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    for (const item of container.querySelectorAll<HTMLElement>(`.${styles.fallingItem}`)) {
      const size = Math.random() * 140 + 25;
      item.style.width = `${size}px`;
      item.style.height = `${size}px`;
      item.style.left = `${Math.random() * 90 + 5}%`;
      item.style.animationDuration = `${Math.random() * 6 + 14}s`;
    }
  }, []);

  return (
    <div ref={containerRef}>
      {[0, 2, 4].map((delay) => (
        <div
          key={`heart-${delay}`}
          className={styles.fallingItem}
          style={{ backgroundImage: `url(${uiImages.heart})`, animationDelay: `${delay}s` }}
        />
      ))}
      {[1, 3, 5].map((delay) => (
        <div
          key={`star-${delay}`}
          className={styles.fallingItem}
          style={{ backgroundImage: `url(${uiImages.star})`, animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}
```

**Step 2: Create CSS module `apps/mobile/src/components/FallingItems.module.css`**

```css
.fallingItem {
  position: fixed;
  opacity: 0;
  pointer-events: none;
  z-index: 0;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  top: -10%;
  animation: fall-down 8s linear infinite;
}

@keyframes fall-down {
  0% {
    top: -10%;
    opacity: 0;
    transform: rotate(0deg);
  }
  5% {
    opacity: 0.2;
  }
  95% {
    opacity: 0.2;
  }
  100% {
    top: 110%;
    opacity: 0;
    transform: rotate(720deg);
  }
}
```

**Step 3: Commit**

```bash
git add apps/mobile/src/components/FallingItems.tsx apps/mobile/src/components/FallingItems.module.css
git commit -m "feat(mobile): add FallingItems component"
```

---

### Task 6: Create PrimaryButton component

**Files:**

- Create: `apps/mobile/src/components/PrimaryButton.tsx`
- Create: `apps/mobile/src/components/PrimaryButton.module.css`

**Step 1: Create component**

```tsx
import { Link } from "@tanstack/react-router";
import { uiImages } from "../assets/images";
import styles from "./PrimaryButton.module.css";
import type { ReactNode } from "react";

interface Props {
  href?: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

export function PrimaryButton({ href, onClick, className = "", children }: Props) {
  const cls = `${styles.primaryButton} ${className}`;
  if (href) {
    return (
      <Link to={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
```

**Step 2: Create CSS module**

```css
.primaryButton {
  padding: var(--space-md) var(--space-lg);
  background: url("") no-repeat center / contain;
  color: var(--color-white);
  font-weight: 600;
  text-align: center;
  width: 12rem;
  height: 10rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}
```

Note: The `background` URL will be set dynamically via inline style in the component because CSS Modules can't reference ES-imported images. Update PrimaryButton.tsx to add inline style:

```tsx
// In the component, add style prop:
const style = { backgroundImage: `url(${uiImages.button})` };
// Add style={style} to both Link and button elements
```

**Step 3: Commit**

```bash
git add apps/mobile/src/components/PrimaryButton.tsx apps/mobile/src/components/PrimaryButton.module.css
git commit -m "feat(mobile): add PrimaryButton component"
```

---

### Task 7: Create CameraCapture component

**Files:**

- Create: `apps/mobile/src/components/CameraCapture.tsx`
- Create: `apps/mobile/src/components/CameraCapture.module.css`

**Step 1: Create component**

```tsx
import { useRef, useEffect, useCallback } from "react";
import { useToast } from "./Toast";
import styles from "./CameraCapture.module.css";

interface Props {
  open: boolean;
  onCapture: (dataURL: string) => void;
  onClose: () => void;
}

export function CameraCapture({ open, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { showToast } = useToast();

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        showToast("カメラの使用が許可されていません。", "error");
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, showToast, stopCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const dataURL = canvas.toDataURL("image/jpeg", 0.8);
    stopCamera();
    onCapture(dataURL);
  };

  if (!open) return null;

  return (
    <div className={styles.cameraCapture}>
      <video ref={videoRef} className={styles.cameraVideo} autoPlay playsInline />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className={styles.cameraControls}>
        <button type="button" onClick={handleCapture} className={styles.captureButton}>
          撮影
        </button>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className={styles.closeButton}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Create CSS module** (copy styles from source CameraCapture.astro)

```css
.cameraCapture {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--color-black);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.cameraVideo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cameraControls {
  position: absolute;
  bottom: var(--space-lg);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--space-md);
}
.captureButton,
.closeButton {
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  font-weight: 600;
  color: var(--color-white);
  background-color: var(--color-brand);
}
.closeButton {
  background-color: var(--color-text-secondary);
}
.captureButton:active,
.closeButton:active {
  opacity: 0.8;
}
```

**Step 3: Commit**

```bash
git add apps/mobile/src/components/CameraCapture.tsx apps/mobile/src/components/CameraCapture.module.css
git commit -m "feat(mobile): add CameraCapture component"
```

---

### Task 8: Create ItemTile and ItemGrid components

**Files:**

- Create: `apps/mobile/src/components/ItemTile.tsx`
- Create: `apps/mobile/src/components/ItemGrid.tsx`
- Create: `apps/mobile/src/components/ItemGrid.module.css`

**Step 1: Create ItemTile**

```tsx
import { itemImages } from "../assets/images";

interface Props {
  itemId: string;
  itemNo: number;
  itemName: string;
  owned: boolean;
  count: number;
  selected: boolean;
  onClick?: () => void;
}

export function ItemTile({ itemId, itemNo, itemName, owned, count, selected, onClick }: Props) {
  return (
    <div
      className={`item-tile ${owned ? "owned" : "unowned"} ${selected ? "selected" : ""}`}
      data-item-id={itemId}
      onClick={owned ? onClick : undefined}
    >
      {owned ? (
        <>
          <img src={itemImages[itemId]} alt={itemName} className="item-image" />
          <div className="item-name">{itemName}</div>
          {count > 1 && <div className="item-badge">×{count}</div>}
        </>
      ) : (
        <div className="item-placeholder">No.{String(itemNo).padStart(2, "0")}</div>
      )}
    </div>
  );
}
```

Note: Uses global CSS classes from utilities.css (item-tile, item-badge etc.) since these are defined in the source CSS layers.

**Step 2: Create ItemGrid**

```tsx
import { ITEMS } from "../lib/items";
import { ItemTile } from "./ItemTile";
import type { InventoryMap } from "../lib/storage";
import styles from "./ItemGrid.module.css";

interface Props {
  inventoryMap: InventoryMap;
  selectedItemIds: string[];
  onItemClick: (itemId: string) => void;
}

export function ItemGrid({ inventoryMap, selectedItemIds, onItemClick }: Props) {
  return (
    <div className={styles.itemGrid}>
      {ITEMS.map((item) => {
        const count = inventoryMap[item.id]?.count ?? 0;
        return (
          <ItemTile
            key={item.id}
            itemId={item.id}
            itemNo={item.no}
            itemName={item.name}
            owned={count > 0}
            count={count}
            selected={selectedItemIds.includes(item.id)}
            onClick={() => onItemClick(item.id)}
          />
        );
      })}
    </div>
  );
}
```

**Step 3: Create CSS module**

```css
.itemGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-sm);
  container-type: inline-size;
}

@container (min-width: 25rem) {
  .itemGrid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@container (min-width: 37.5rem) {
  .itemGrid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

**Step 4: Commit**

```bash
git add apps/mobile/src/components/ItemTile.tsx apps/mobile/src/components/ItemGrid.tsx apps/mobile/src/components/ItemGrid.module.css
git commit -m "feat(mobile): add ItemTile and ItemGrid components"
```

---

### Task 9: Set up route structure

**Files:**

- Modify: `apps/mobile/src/routes/__root.tsx`
- Delete: `apps/mobile/src/routes/index.tsx`
- Create: `apps/mobile/src/routes/u/$userId.tsx` (layout route)
- Create: `apps/mobile/src/routes/u/$userId/index.tsx` (home)
- Create: `apps/mobile/src/routes/u/$userId/costumes.tsx` (closet)
- Create: `apps/mobile/src/routes/u/$userId/gacha/$costumeKey.tsx` (gacha result)

**Step 1: Update `__root.tsx`**

```tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TRPCProvider } from "../lib/trpc-provider";
import { ToastProvider } from "../components/Toast";
import { FallingItems } from "../components/FallingItems";

export const Route = createRootRoute({
  component: () => (
    <TRPCProvider>
      <ToastProvider>
        <FallingItems />
        <div style={{ position: "relative", zIndex: 1 }}>
          <Outlet />
        </div>
      </ToastProvider>
    </TRPCProvider>
  ),
});
```

**Step 2: Create userId layout `apps/mobile/src/routes/u/$userId.tsx`**

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/u/$userId")({
  component: () => <Outlet />,
});
```

**Step 3: Create home page `apps/mobile/src/routes/u/$userId/index.tsx`**

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { CameraCapture } from "../../../components/CameraCapture";
import { storage } from "../../../lib/storage";
import { ITEMS } from "../../../lib/items";
import { drawGacha, addToInventory } from "../../../lib/api";
import { uiImages } from "../../../assets/images";
import { itemImages } from "../../../assets/images";
import styles from "./index.module.css";

function HomePage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState(() => storage.getPhoto());
  const selectedItemIds = storage.getSelectedItems();
  const selectedItems = selectedItemIds
    .map((id) => ITEMS.find((item) => item.id === id))
    .filter((item): item is (typeof ITEMS)[number] => item !== undefined);

  const handleCapture = (dataURL: string) => {
    storage.savePhoto(dataURL);
    setPhoto(dataURL);
    setCameraOpen(false);
  };

  const handleGacha = () => {
    const item = drawGacha();
    addToInventory(item.id);
    navigate({ to: "/u/$userId/gacha/$costumeKey", params: { userId, costumeKey: item.id } });
  };

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.logoContainer}>
        <img src={uiImages.logo} alt="こらぼりずむ" className={styles.logo} />
      </div>

      <div className={styles.characterSection}>
        <div className={styles.characterImage}>
          {photo ? (
            <img src={photo} alt="撮影した写真" className={styles.photoPreview} />
          ) : (
            <img
              src={uiImages.defaultChar}
              alt="デフォルト画像"
              className={styles.characterPlaceholder}
            />
          )}
          {selectedItems.length > 0 && (
            <div className={styles.characterBadges}>
              {selectedItems.map((item) => (
                <img
                  key={item.id}
                  src={itemImages[item.id]}
                  alt={item.name}
                  className={styles.characterBadge}
                />
              ))}
            </div>
          )}
          {selectedItems.length > 0 && (
            <div className={styles.characterCaption}>
              {selectedItems.map((item) => item.name).join(" / ")}
            </div>
          )}

          <PrimaryButton
            onClick={() => setCameraOpen(true)}
            className="button-position button-top-left"
          >
            しゃしんをとろう！
          </PrimaryButton>
          <PrimaryButton
            href={`/u/${userId}/costumes`}
            className="button-position button-right-center"
          >
            コーディネートにちょうせん！
          </PrimaryButton>
          <PrimaryButton onClick={handleGacha} className="button-position button-bottom-left">
            オシャレカードをゲット！
          </PrimaryButton>

          <img src={uiImages.magiccircle} alt="魔法陣" className={styles.magicCircle} />
        </div>
      </div>

      <CameraCapture
        open={cameraOpen}
        onCapture={handleCapture}
        onClose={() => setCameraOpen(false)}
      />
    </div>
  );
}

export const Route = createFileRoute("/u/$userId/")({
  component: HomePage,
});
```

**Step 4: Create CSS module `apps/mobile/src/routes/u/$userId/index.module.css`**

Port the scoped styles from `index.astro` <style> block.

**Step 5: Create gacha page `apps/mobile/src/routes/u/$userId/gacha/$costumeKey.tsx`**

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { ITEMS } from "../../../../lib/items";
import { cardImages, uiImages } from "../../../../assets/images";
import { PrimaryButton } from "../../../../components/PrimaryButton";
import styles from "./$costumeKey.module.css";

function GachaResultPage() {
  const { userId, costumeKey } = Route.useParams();
  const item = ITEMS.find((i) => i.id === costumeKey);

  if (!item) {
    return (
      <div className="page container">
        <p>アイテムが見つかりません</p>
        <PrimaryButton href={`/u/${userId}`}>トップにもどる</PrimaryButton>
      </div>
    );
  }

  const cardBackImage = item.rarity === "SSR" ? uiImages.cardBackSsr : uiImages.cardBack;

  return (
    <div className="page container">
      <div className={styles.gachaResult}>
        <div className="card auto-flip mb-md">
          <div className="front">
            <img src={cardImages[item.id]} alt={item.name} />
          </div>
          <div className="back">
            <img src={cardBackImage} alt="カード裏面" />
          </div>
        </div>
      </div>
      <div className={styles.buttonGroup}>
        <PrimaryButton href={`/u/${userId}`}>トップにもどる</PrimaryButton>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/u/$userId/gacha/$costumeKey")({
  component: GachaResultPage,
});
```

**Step 6: Create gacha CSS module `apps/mobile/src/routes/u/$userId/gacha/$costumeKey.module.css`**

```css
.gachaResult {
  position: relative;
  display: flex;
  justify-content: center;
}

.buttonGroup {
  display: flex;
  flex-direction: column;
  align-items: center;
}
```

**Step 7: Create costumes page `apps/mobile/src/routes/u/$userId/costumes.tsx`**

```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ItemGrid } from "../../../components/ItemGrid";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { useToast } from "../../../components/Toast";
import { storage } from "../../../lib/storage";
import { ITEMS, type ItemLayer } from "../../../lib/items";
import { saveSelection } from "../../../lib/api";
import { uiImages, itemImages } from "../../../assets/images";
import styles from "./costumes.module.css";

function CostumesPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [inventoryMap] = useState(() => storage.getInventory());
  const [selectedItemIds, setSelectedItemIds] = useState(() => storage.getSelectedItems());
  const photo = storage.getPhoto();

  const selectedItems = selectedItemIds
    .map((id) => ITEMS.find((item) => item.id === id))
    .filter((item): item is (typeof ITEMS)[number] => item !== undefined);

  const handleItemClick = (itemId: string) => {
    const item = ITEMS.find((i) => i.id === itemId);
    if (!item) return;

    setSelectedItemIds((prev) => {
      const index = prev.indexOf(itemId);
      let next: string[];
      if (index > -1) {
        next = prev.filter((id) => id !== itemId);
      } else {
        next = prev.filter((id) => {
          const existing = ITEMS.find((i) => i.id === id);
          return existing?.layer !== item.layer;
        });
        next.push(itemId);
      }
      storage.saveSelectedItems(next);
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedItemIds.length === 0) {
      showToast("アイテムを選択してください", "error");
      return;
    }
    saveSelection(selectedItemIds);
    showToast("コーディネートを保存しました！", "success");
    setTimeout(() => navigate({ to: "/u/$userId", params: { userId } }), 1500);
  };

  const layers: { key: ItemLayer; label: string }[] = [
    { key: "face", label: "アクセサリー" },
    { key: "upper", label: "トップス" },
    { key: "lower", label: "ボトムス" },
    { key: "shoes", label: "くつ" },
  ];

  return (
    <div className="page container">
      <Link
        to="/u/$userId"
        params={{ userId }}
        className={styles.homeButton}
        aria-label="トップへもどる"
      >
        ←
      </Link>

      <div className={styles.closetInfo}>
        <div className={styles.characterSection}>
          <div className={styles.characterImage}>
            {photo ? (
              <img src={photo} alt="撮影した写真" className={styles.photoPreview} />
            ) : (
              <img
                src={uiImages.defaultChar}
                alt="デフォルト画像"
                className={styles.characterPlaceholder}
              />
            )}
            {selectedItems.length > 0 && (
              <div className={styles.characterBadges}>
                {selectedItems.map((item) => (
                  <img
                    key={item.id}
                    src={itemImages[item.id]}
                    alt={item.name}
                    className={styles.characterBadge}
                  />
                ))}
              </div>
            )}
            {selectedItems.length > 0 && (
              <div className={styles.characterCaption}>
                {selectedItems.map((item) => item.name).join(" / ")}
              </div>
            )}
            <img src={uiImages.magiccircle} alt="魔法陣" className={styles.magicCircle} />
          </div>
        </div>
      </div>

      <div className={styles.layerStatus}>
        {layers.map(({ key, label }) => {
          const selected = selectedItemIds.find((id) => {
            const item = ITEMS.find((i) => i.id === id);
            return item?.layer === key;
          });
          const selectedItem = selected ? ITEMS.find((i) => i.id === selected) : null;
          return (
            <div key={key} className={styles.layerStatusItem}>
              <span className={styles.layerLabel}>{label}</span>
              <span
                className={`${styles.layerSelected} ${selectedItem ? styles.hasSelection : ""}`}
              >
                {selectedItem?.name ?? "未選択"}
              </span>
            </div>
          );
        })}
      </div>

      <ItemGrid
        inventoryMap={inventoryMap}
        selectedItemIds={selectedItemIds}
        onItemClick={handleItemClick}
      />

      <div className={styles.buttonGroup}>
        <PrimaryButton onClick={handleSave}>このコーディネートにする！</PrimaryButton>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/u/$userId/costumes")({
  component: CostumesPage,
});
```

**Step 8: Create costumes CSS module `apps/mobile/src/routes/u/$userId/costumes.module.css`**

Port the scoped styles from `closet.astro`.

**Step 9: Remove old `apps/mobile/src/routes/index.tsx`**

```bash
rm apps/mobile/src/routes/index.tsx
```

**Step 10: Commit**

```bash
git add apps/mobile/src/routes/ apps/mobile/src/components/
git commit -m "feat(mobile): add all routes and page components"
```

---

### Task 10: Add body/root styles for gradient background

**Files:**

- Modify: `apps/mobile/src/index.css`

**Step 1: Add body gradient styles**

Add to `index.css` after the imports:

```css
@import "tailwindcss";
@import "./styles/global.css";

body {
  position: relative;
  background: var(--gradient-pink);
  background-size: 200% 200%;
  animation: gradient-shift 8s ease infinite;
  overflow-x: hidden;
  min-height: 100vh;
}

@keyframes gradient-shift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
```

**Step 2: Commit**

```bash
git add apps/mobile/src/index.css
git commit -m "feat(mobile): add gradient background animation"
```

---

### Task 11: Build verification

**Step 1: Run the build**

```bash
cd apps/mobile && bun run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 2: Fix any build errors**

Address any type errors or missing imports.

**Step 3: Run dev server and visually verify**

```bash
cd apps/mobile && bun run dev
```

Navigate to `http://localhost:5173/u/test-user` and verify:

- Falling hearts/stars animation
- Pink gradient background
- Logo, character area, 3 buttons
- Gacha flow: click button → navigate to `/u/test-user/gacha/<item-id>` → card flip
- Costumes: navigate → item grid → select items → save

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(mobile): complete mobile app migration from Astro to React"
```
