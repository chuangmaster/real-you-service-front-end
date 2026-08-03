# LIFF Order Share Metadata Fix — Implementation Record

> Spec: `docs/superpowers/specs/2026-07-30-order-share-meta-design.md`

**Goal:** Fix the LINE preview card for `/order?t={token}` links (wrong static title, no description) and give each route its own accurate page title, without breaking the real LIFF in-app browser's interactive flow.

**Architecture:** UA-branching in `nginx.conf` (mirrored in `vite.config.ts` for dev), a neutral baseline in `index.html`, and per-route/per-fetch `document.title` updates in `src/router/index.ts` + the two data-driven views. No new dependencies.

## Changes made

### Task 1: `index.html` baseline meta — done
Replaced the wrong, site-wide `<title>REAL YOU | Luxury Authentication Report</title>` with a neutral `REAL YOU`, and added `og:type`/`og:site_name`/`og:title`/`og:description`/`twitter:card`. This is the fallback any non-JS crawler sees when UA-detection doesn't match and/or the backend share endpoint isn't live yet.

### Task 2: Dynamic per-route document titles — done
- `src/router/index.ts`: added `RouteMeta.title`, set per-route defaults (`home` / `product-detail` / `order`), and a `router.afterEach` that applies `to.meta.title` on every navigation.
- `src/views/ProductDetailView.vue` (`fetchProductDetails`): on success, overwrites `document.title` to `REAL YOU | {brandName} {styleName} 鑑定證書`.
- `src/views/OrderView.vue` (`fetchOrderSummary`): on success, overwrites `document.title` to `REAL YOU | 訂單 #{orderNumber}`.

These only affect real browsers (JS has to run) — they don't change what a non-JS crawler sees.

### Task 3: nginx UA-branching for `/order` — done
Added to `nginx.conf`:
- `map $http_user_agent $is_link_preview_bot { default 0; ~*Linespider 1; }` (outside the `server {}` block).
- `location = /order`: rewrites to a new internal location when `$is_link_preview_bot`, otherwise falls through to the existing `try_files ... /index.html` SPA behavior.
- `location = /__order-share` (`internal`): proxies to `${API_TARGET_URL}/api/public/orders/share?t=$arg_t`, same resolver/header conventions as the existing `/api/` and `/product/{id}/share` blocks.

Matches specifically on `Linespider` (LINE's documented link-preview crawler UA token), not a broader `Line` substring — the real LIFF in-app browser's own UA also contains `Line/`, and a loose match would have broken the live binding flow for real customers.

### Task 4: `vite.config.ts` dev-mirror — done
Added a `^/order$` proxy entry using a `bypass` function to replicate the same UA check in JS (Vite has no `map`/`if`), rewriting to `/api/public/orders/share` while preserving the `?t=` query string.

## Verification performed

- `npm run type-check` — passed, no errors.
- `npm run build` — succeeded (pre-existing chunk-size warning only, unrelated).
- Live routing test: built the rendered `nginx.conf` inside `nginx:stable-alpine` (via `docker run ... nginx -t`, confirmed syntax) and ran it against a throwaway stub backend (Python `http.server`) on an isolated Docker network. Confirmed:
  1. Plain/browser UA on `/order?t=abc123` → SPA `index.html`.
  2. `Linespider` UA on `/order?t=abc123` → stub received `GET /api/public/orders/share?t=abc123`.
  3. A spoofed real-LIFF UA (`Line/13.5.0 Chrome/... Mobile Safari/...`, no `Linespider`) on the same URL → still SPA `index.html` (confirms no false-positive bot detection against real customers).
  4. `/product/{id}/share` unaffected — still proxies to `/api/public/inventory/{id}/share` as before.
- Test containers/network and scratch stub script were torn down after verification; no leftover Docker state.

## Follow-up (not part of this change — cross-repo)

Backend needs to implement `GET /api/public/orders/share?t={token}` returning server-rendered HTML with `<title>`/`og:title` = `REAL YOU | 訂單 #{orderNumber}` and `og:description` = order items' brand/style (no `customerName` — see spec §4 for the PII rationale). Until that endpoint exists, the `/order` UA-branch has nowhere real to proxy to in production; the actual LINE preview card can only be end-to-end verified once it's live.

## Commit

Not yet committed — awaiting explicit go-ahead per this repo's usual workflow (commits are user-requested, not automatic).
