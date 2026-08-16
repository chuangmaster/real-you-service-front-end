# Product Route Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the certificate page's public URL from `/product/:id` to `/identification-report/:id` (and its share sub-path from `/product/:id/share` to `/identification-report/:id/share`), with automatic forwarding from the old paths so no existing or future link breaks.

**Architecture:** A one-line path change plus a new redirect route in `src/router/index.ts` handles the plain page (client-side, since it's normal SPA territory). The `/share` sub-path is intercepted by nginx before the SPA ever loads (crawler-facing, server-rendered), so it needs a matching nginx-level 301 redirect plus an updated proxy regex, mirrored into `vite.config.ts`'s dev-server proxy per this repo's existing convention for that rule.

**Tech Stack:** Vue Router (plain `RouteRecordRaw[]`, no typed-router codegen), nginx (template config, envsubst-rendered at container start), Vite dev server proxy — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-16-product-route-rename-design.md`

## Global Constraints

- This repo has no test runner and no lint script (confirmed in `CLAUDE.md`). Verification uses `npm run type-check` (`vue-tsc --noEmit`), `npm run build`, and manual `npm run dev` browser checks.
- Do **not** rename `ProductDetailView.vue`, the route `name: 'product-detail'`, or the `detail.*` i18n namespace — this plan changes only the public URL path, nothing internal. Every existing `{ name: 'product-detail' }` reference elsewhere in the codebase (`IdentificationReportView.vue`, `OrderView.vue`, the member-center order detail views) needs no change, because they link by route name, not by path.
- `nginx.conf` is a template rendered by nginx's built-in envsubst templating at container start (`${DNS_RESOLVER}`, `${API_TARGET_URL}` placeholders) — it cannot be syntax-checked locally. Verify correctness by matching the existing regex `location` block's exact style (indentation, variable usage) rather than by running nginx.
- `vite.config.ts`'s `server.proxy` must mirror whatever regex/rewrite change is made to `nginx.conf`'s product-share `location` block — this is an existing, documented project convention (see `CLAUDE.md`'s "The `/product/{id}/share` route is NOT a Vue route" section), not new to this plan.
- The old-path redirect for `/product/:id/share` only takes effect where nginx is present (production/deployed environments) — it cannot be exercised end-to-end via `npm run dev` locally. This is a known, accepted verification gap already called out in the spec's "不在此規格範圍" section, not a plan defect.
- No backend changes are required or requested by this plan (see spec's "相依阻塞／假設事項" — the redirect transparently absorbs it even if the backend's share HTML still points at the old path).

---

### Task 1: Rename the `product-detail` route path and add the old-path redirect

**Files:**
- Modify: `src/router/index.ts`

**Interfaces:**
- Consumes: nothing new — `ProductDetailView` is already imported.
- Produces: route `name: 'product-detail'` now resolves to path `/identification-report/:id` instead of `/product/:id`. A new unnamed route at path `/product/:id` redirects to it. No other route's name, path, or import changes.

- [ ] **Step 1: Change the route path and add the redirect**

Find this in `src/router/index.ts`:

```ts
  {
    path: '/product/:id',
    name: 'product-detail',
    component: ProductDetailView,
    meta: { title: 'REAL YOU | 精品鑑定證書' }
  },
```

Replace with:

```ts
  {
    path: '/identification-report/:id',
    name: 'product-detail',
    component: ProductDetailView,
    meta: { title: 'REAL YOU | 精品鑑定證書' }
  },
  {
    path: '/product/:id',
    redirect: (to) => ({ name: 'product-detail', params: to.params })
  },
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, then in a browser:
- Open `http://localhost:5173/identification-report/{a real product UUID from your local backend}` — confirm the certificate page renders normally (this is the new canonical URL).
- Open `http://localhost:5173/product/{the same UUID}` — confirm the browser's address bar updates to `/identification-report/{UUID}` and the same certificate page renders (this is the old URL being redirected).
- From `http://localhost:5173/identification-report` (the search page), search that same UUID and confirm it still navigates correctly to the certificate page (this exercises the existing `router.push({ name: 'product-detail', ... })` call in `IdentificationReportView.vue`, unchanged by this task, to confirm route-name-based navigation still works after the path change).

- [ ] **Step 5: Commit**

```bash
git add src/router/index.ts
git commit -m "feat: move product-detail route to /identification-report/:id

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Update nginx's share-link proxy and its Vite dev-server mirror

**Files:**
- Modify: `nginx.conf`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: nothing from Task 1 — this task is independent of the router change (it only affects the `/share` sub-path, which is intercepted before the SPA/router ever runs).
- Produces: `nginx.conf` now has a 301-redirect `location` for the old `^/product/([^/]+)/share$` pattern, and its former proxy-to-backend `location` now matches `^/identification-report/([^/]+)/share$` instead. `vite.config.ts`'s dev-server proxy key mirrors the new pattern for local development.

- [ ] **Step 1: Add the redirect location and update the proxy location in `nginx.conf`**

Find this in `nginx.conf`:

```nginx
    location ~ ^/product/([^/]+)/share$ {
        resolver ${DNS_RESOLVER} ipv6=on valid=1s;
        set $upstream_target ${API_TARGET_URL}/api/public/inventory/$1/share;
        proxy_pass $upstream_target;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

Replace with:

```nginx
    location ~ ^/product/([^/]+)/share$ {
        return 301 /identification-report/$1/share;
    }

    location ~ ^/identification-report/([^/]+)/share$ {
        resolver ${DNS_RESOLVER} ipv6=on valid=1s;
        set $upstream_target ${API_TARGET_URL}/api/public/inventory/$1/share;
        proxy_pass $upstream_target;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

- [ ] **Step 2: Update the mirrored proxy rule in `vite.config.ts`**

Find this in `vite.config.ts`:

```ts
      '^/product/.+/share$': {
        target: 'http://localhost:5100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/product\/(.+)\/share$/, '/api/public/inventory/$1/share'),
      }
```

Replace with:

```ts
      '^/identification-report/.+/share$': {
        target: 'http://localhost:5100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/identification-report\/(.+)\/share$/, '/api/public/inventory/$1/share'),
      }
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: passes with no errors (`vite.config.ts` is TypeScript, part of this check).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 5: Manual smoke test (dev-server proxy only — nginx redirect is not locally testable, see Global Constraints)**

Run: `npm run dev`, then use `curl` (or a browser) against `http://localhost:5173/identification-report/{a real product UUID}/share` — confirm the response is the backend's server-rendered share HTML (same content that `/product/{id}/share` used to return before this change), not the SPA's `index.html`. This confirms the Vite proxy rewrite is correctly matching the new path and forwarding to `/api/public/inventory/{id}/share` on the local backend.

Do not attempt to test the nginx-level 301 redirect from `/product/:id/share` locally — there is no nginx in the `npm run dev` environment. Note in your report that this specific behavior (old share-link redirect) can only be verified after deployment.

- [ ] **Step 6: Commit**

```bash
git add nginx.conf vite.config.ts
git commit -m "feat: redirect old /product/:id/share links to /identification-report

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
