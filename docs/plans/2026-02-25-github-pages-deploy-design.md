# GitHub Pages Deploy Design

## Goal

Deploy admin and projector apps as static demos to GitHub Pages.

## URLs

```
https://nulab.github.io/hackz-hackathon-2602/          → index (links to apps)
https://nulab.github.io/hackz-hackathon-2602/admin/     → admin app
https://nulab.github.io/hackz-hackathon-2602/projector/ → projector app
```

## Approach

Use `actions/upload-pages-artifact` + `actions/deploy-pages` (GitHub official).

## Changes

1. **`.github/workflows/deploy.yml`** (new) — deploy workflow triggered on `main` push
2. **`apps/admin/vite.config.ts`** — add `base: "/hackz-hackathon-2602/admin/"`
3. **`apps/projector/vite.config.ts`** — add `base: "/hackz-hackathon-2602/projector/"`

## Workflow Structure

- **build job**: checkout → setup bun → install → build → assemble `_site/` → upload artifact
- **deploy job**: `actions/deploy-pages`
- Trigger: `push` to `main` only
- Permissions: `pages: write`, `id-token: write`

## Notes

- API connection is hardcoded to localhost — not relevant for this static demo deployment
- CI (lint/test) remains in existing `ci.yml`
- Root `index.html` provides navigation links to both apps
