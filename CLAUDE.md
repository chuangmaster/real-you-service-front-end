# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Vue 3 + Vite single-page app ("REAL YOU") that lets a user enter a product UUID and view its luxury-goods authentication certificate (brand/style/serial, accessory checklist, product/appraisal photo galleries, and a downloadable PDF certificate card with QR code). It is a public-facing lookup tool with no auth, backed by a separate ASP.NET-style backend (reachable locally at `http://localhost:5176`, exposing endpoints under `/api/public/inventory/...`).

## Commands

- `npm run dev` — start Vite dev server (proxies `/api` and `/product/{id}/share` to the backend, see below)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build locally

There is no test suite and no lint script configured in `package.json`.

## Architecture

### Routing is intentionally minimal
`src/router/index.js` defines exactly two routes: `/` (`HomeView`, a UUID search form) and `/product/:id` (`ProductDetailView`, the certificate page). Any unmatched path redirects to `/`. Don't assume other views under `src/pages/` or `src/layouts/` are wired up — `src/pages/order-management/components/BrandBanner.vue` and `src/layouts/components/Logo/index.vue` are unused leftover scaffolding from the original Vue template and are not imported anywhere.

### Data flow in `ProductDetailView.vue`
Fetches `GET /api/public/inventory/{id}` via axios. The API wraps responses as `{ success, data }`, but the component also falls back to treating the raw body as the DTO directly — preserve both paths if touching this fetch logic. A 404 and other errors map to distinct i18n error messages (`detail.error404` vs `detail.errorServer`).

Images come back in a flat `images[]` array; the frontend splits them into two galleries client-side using `img.imageType === 'APPRAISAL'` (product photos vs. appraisal/inspection photos) and sorts by `uploadOrder`. Both galleries always render 10 grid slots, backfilling with empty placeholder tiles when there are fewer real images — this is a deliberate design choice (matches `sample.html`), not a bug.

The accessories list (`box`, `dustBag`, etc.) is currently **hardcoded/mocked** in the component (`accessories` computed), not sourced from the API — the comment in the code notes the public API doesn't provide this metadata yet.

### Certificate PDF/QR generation
`openCertificateModal` generates a QR code (via `qrcode`) encoding `window.location.href`, then `handleDownloadCard` rasterizes the certificate card DOM node with `html2canvas` and embeds it into a PDF via `jspdf`, sized to the canvas dimensions. This only works client-side in a real browser context (`document.fonts.ready`, canvas APIs) — it cannot be exercised in a headless/non-DOM test.

### i18n
`src/i18n.js` defines all UI strings inline (no external JSON files) for `en` and `zh-TW`, with `zh-TW` as the default locale and `en` as fallback. `App.vue` has a manual locale toggle button that flips `locale.value` between the two. When adding UI text, add both locale entries in this single file — there is no separate translation-loading mechanism.

### The `/product/{id}/share` route is NOT a Vue route
This app is built to static files and served by nginx (see `Dockerfile`, `nginx.conf`), so Vue Router only runs after JS loads in a browser — it cannot serve crawler-friendly HTML with meta tags. Instead, `/product/{id}/share` is intercepted at the **nginx layer** via a regex `location` block that proxies straight through to the backend's server-rendered HTML at `${API_TARGET_URL}/api/public/inventory/{id}/share`, bypassing the SPA entirely (regex locations take precedence over the `location /` SPA fallback). The equivalent proxy rule is mirrored in `vite.config.js`'s dev server (`server.proxy`) so local dev behaves the same way. If you change one, change the other. See `docs/superpowers/specs/2026-07-05-product-share-route-design.md` for the full rationale.

### Deployment
Multi-stage `Dockerfile`: Vite build → static files served by `nginx:stable-alpine`. `nginx.conf` is a template (`${PORT}`, `${DNS_RESOLVER}`, `${API_TARGET_URL}` placeholders) rendered by nginx's built-in envsubst templating at container start. `entrypoint.sh` runs first to detect the container's DNS resolver from `/etc/resolv.conf` (needed because nginx's `resolver` directive requires an explicit IP, and `API_TARGET_URL`'s host must be resolved dynamically since Railway assigns it at runtime) before handing off to the standard nginx entrypoint.

### Design tokens
Tailwind (`tailwind.config.js`) is extended with a full Material-Design-3-style token set (semantic color names like `primary-container`, `on-surface`, `surface-container-low`; typographic scale like `headline-sm`, `label-caps`, `data-mono`). Prefer these semantic tokens over raw Tailwind colors/sizes when styling — they're what the rest of the app (and `sample.html`, the original static mockup) uses. `AFuturaOrto` (brand wordmark) and `Playfair Display`/`Inter` are the font families in play.

### Planning docs
`docs/superpowers/` contains dated spec/plan markdown files (one spec + one plan per feature, e.g. `2026-07-05-product-share-route-design.md` / `2026-07-06-product-share-route.md`) written before implementing non-trivial changes. Check here for the reasoning behind existing infra/proxy decisions before re-deriving them from scratch.

## Language
All documentation and comments are in Tranditional Chinese, but the code itself is in English. Please do not mix languages in code identifiers or comments.