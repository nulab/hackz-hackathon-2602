# GitHub Pages Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy admin and projector apps as static demos to GitHub Pages at `/admin/` and `/projector/` subpaths.

**Architecture:** Vite `base` option sets asset prefix per app. A new GitHub Actions workflow builds both apps, assembles them into a single `_site/` directory with a root index.html, and deploys via `actions/deploy-pages`.

**Tech Stack:** Vite, GitHub Actions, `actions/upload-pages-artifact`, `actions/deploy-pages`

---

### Task 1: Update admin Vite config with base path

**Files:**

- Modify: `apps/admin/vite.config.ts`

**Step 1: Add base option**

```ts
export default defineConfig({
  base: "/hackz-hackathon-2602/admin/",
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  server: {
    port: 5175,
  },
});
```

**Step 2: Verify build works**

Run: `cd apps/admin && bun run build`
Expected: Build succeeds, check `dist/index.html` contains `/hackz-hackathon-2602/admin/` prefixed asset paths.

**Step 3: Commit**

```bash
git add apps/admin/vite.config.ts
git commit -m "feat(admin): add base path for GitHub Pages deployment"
```

---

### Task 2: Update projector Vite config with base path

**Files:**

- Modify: `apps/projector/vite.config.ts`

**Step 1: Add base option**

```ts
export default defineConfig({
  base: "/hackz-hackathon-2602/projector/",
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  server: {
    port: 5174,
  },
});
```

**Step 2: Verify build works**

Run: `cd apps/projector && bun run build`
Expected: Build succeeds, check `dist/index.html` contains `/hackz-hackathon-2602/projector/` prefixed asset paths.

**Step 3: Commit**

```bash
git add apps/projector/vite.config.ts
git commit -m "feat(projector): add base path for GitHub Pages deployment"
```

---

### Task 3: Create GitHub Pages deploy workflow

**Files:**

- Create: `.github/workflows/deploy.yml`

**Step 1: Write the workflow file**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1

      - name: Setup Bun
        uses: oven-sh/setup-bun@3d267786b128fe76c2f16a390aa2448b815359f3 # v2.1.2
        with:
          bun-version-file: package.json

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build
        run: bun run build

      - name: Assemble site
        run: |
          mkdir -p _site/admin _site/projector
          cp -r apps/admin/dist/* _site/admin/
          cp -r apps/projector/dist/* _site/projector/
          cat > _site/index.html << 'HTML'
          <!DOCTYPE html>
          <html lang="ja">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>hackz-hackathon-2602</title>
            <style>
              body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 16px; }
              a { display: block; padding: 16px; margin: 12px 0; background: #f3f4f6; border-radius: 8px; text-decoration: none; color: #111; font-size: 1.1rem; }
              a:hover { background: #e5e7eb; }
            </style>
          </head>
          <body>
            <h1>hackz-hackathon-2602</h1>
            <a href="./admin/">Admin</a>
            <a href="./projector/">Projector</a>
          </body>
          </html>
          HTML

      - name: Upload artifact
        uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3.0.1
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac553fd0d31 # v4.0.5
```

**Step 2: Verify YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"`
Expected: No errors.

**Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Pages deploy workflow for admin and projector"
```

---

### Task 4: Verify full build

**Step 1: Run full monorepo build**

Run: `bun run build`
Expected: All apps build successfully.

**Step 2: Verify assembled output locally**

Run:

```bash
mkdir -p /tmp/_site/admin /tmp/_site/projector
cp -r apps/admin/dist/* /tmp/_site/admin/
cp -r apps/projector/dist/* /tmp/_site/projector/
ls -la /tmp/_site/admin/index.html /tmp/_site/projector/index.html
```

Expected: Both `index.html` files exist.

**Step 3: Check asset paths**

Run: `grep -o 'src="[^"]*"' /tmp/_site/admin/index.html`
Expected: Paths start with `/hackz-hackathon-2602/admin/`

Run: `grep -o 'src="[^"]*"' /tmp/_site/projector/index.html`
Expected: Paths start with `/hackz-hackathon-2602/projector/`
