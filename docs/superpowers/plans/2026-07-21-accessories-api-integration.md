# Accessories API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "隨附配件" (accessories) section on the product detail page reflect each product's real accessory data from the backend API, instead of the current hardcoded mock list, and repoint the local dev proxy from the backend's old port (5176) to its new port (5000).

**Architecture:** `ProductDetailView.vue`'s `InventoryItem` interface gains an `accessories?: string[]` field. The existing `accessories` computed is rewritten to map a fixed-order array of 13 `{ key, icon }` definitions against `item.value.accessories` via `.includes()`, instead of returning hardcoded `present` booleans. Separately, `vite.config.ts`'s two proxy targets and the port mentioned in `CLAUDE.md` are updated from `5176` to `5000`.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, vue-i18n, Vite dev server proxy config. No new npm dependencies.

## Global Constraints

- Backend `accessories` field is a string array of *only the accessory codes present* on that product (e.g. `["box", "card", "certificate"]`); codes not listed are absent. Codes are camelCase and match the existing `detail.accList.*` i18n keys exactly (spec: `docs/superpowers/specs/2026-07-21-accessories-api-integration-design.md`).
- A `"none"` code (or any other unrecognized string) must NOT be special-cased — it simply won't match any of the 13 known keys, so it naturally renders as "all absent." Do not add an `if (code === 'none')` branch.
- `accessories` being `undefined`/`null` (missing field) must render all 13 items as absent (`present: false`), matching current placeholder/empty-state visuals — no separate empty-state UI.
- Display order of the 13 accessory slots stays fixed in the existing frontend order; it does not follow the order of the API array.
- This repo has no test runner and no lint script (`npm run type-check` runs `vue-tsc --noEmit`, `npm run build` runs a production Vite build — these are the available objective checks). Verification steps in this plan use those two commands plus manual browser checks via `npm run dev`.

---

### Task 1: Point local dev proxy at the backend's new port (5000)

**Files:**
- Modify: `vite.config.ts:10`, `vite.config.ts:14`
- Modify: `CLAUDE.md` (the sentence documenting the local backend port)

**Interfaces:**
- No code interfaces — configuration/documentation only.

- [ ] **Step 1: Update `vite.config.ts` proxy targets**

Current content (both `target` lines read `'http://localhost:5176'`):

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5176',
        changeOrigin: true,
      },
      '^/product/.+/share$': {
        target: 'http://localhost:5176',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/product\/(.+)\/share$/, '/api/public/inventory/$1/share'),
      }
    }
  }
})
```

Replace both `target: 'http://localhost:5176'` occurrences with `target: 'http://localhost:5000'`, so the file reads:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '^/product/.+/share$': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/product\/(.+)\/share$/, '/api/public/inventory/$1/share'),
      }
    }
  }
})
```

- [ ] **Step 2: Update `CLAUDE.md`'s documented port**

Find this sentence in the "What this is" section:

```
It is a public-facing lookup tool with no auth, backed by a separate ASP.NET-style backend (reachable locally at `http://localhost:5176`, exposing endpoints under `/api/public/inventory/...`).
```

Replace `5176` with `5000`:

```
It is a public-facing lookup tool with no auth, backed by a separate ASP.NET-style backend (reachable locally at `http://localhost:5000`, exposing endpoints under `/api/public/inventory/...`).
```

- [ ] **Step 3: Confirm no leftover references to the old port**

Run: `grep -rn "5176" --include="*.ts" --include="*.md" --include="*.vue" .`
Expected: no output (empty result) — every reference has moved to `5000`.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts CLAUDE.md
git commit -m "chore: point local dev proxy at backend port 5000"
```

---

### Task 2: Wire the Accessories section to real API data

**Files:**
- Modify: `src/views/ProductDetailView.vue:19-26` (interface)
- Modify: `src/views/ProductDetailView.vue:142-157` (computed)

**Interfaces:**
- Consumes: existing `item` ref (`Ref<InventoryItem | null>`), existing `t` from `useI18n()` — both already in scope in this file, unchanged by this task.
- Produces: `accessories` computed keeps its existing shape (`{ name: string; icon: string; present: boolean }[]`, 13 entries, fixed order) — the template's `v-for="acc in accessories"` block (around line 445) requires no changes.

- [ ] **Step 1: Add `accessories` to the `InventoryItem` interface**

Find:

```ts
interface InventoryItem {
  id?: string
  inventoryNumber?: string
  brandName?: string
  styleName?: string
  serialId?: string
  images?: InventoryImage[]
}
```

Replace with:

```ts
interface InventoryItem {
  id?: string
  inventoryNumber?: string
  brandName?: string
  styleName?: string
  serialId?: string
  images?: InventoryImage[]
  accessories?: string[]
}
```

- [ ] **Step 2: Replace the hardcoded `accessories` computed with the API-backed version**

Find:

```ts
// Accessories list (mock metadata since not provided by standard public API)
const accessories = computed(() => [
  { name: t('detail.accList.box'), icon: 'inventory_2', present: true },
  { name: t('detail.accList.dustBag'), icon: 'shopping_bag', present: true },
  { name: t('detail.accList.purchaseProof'), icon: 'receipt_long', present: true },
  { name: t('detail.accList.shoppingBag'), icon: 'shopping_cart', present: true },
  { name: t('detail.accList.shoulderStrap'), icon: 'link', present: false },
  { name: t('detail.accList.felt'), icon: 'texture', present: false },
  { name: t('detail.accList.pillow'), icon: 'chair', present: false },
  { name: t('detail.accList.card'), icon: 'credit_card', present: true },
  { name: t('detail.accList.lockKey'), icon: 'lock', present: false },
  { name: t('detail.accList.ribbon'), icon: 'bookmark', present: false },
  { name: t('detail.accList.brandCard'), icon: 'badge', present: true },
  { name: t('detail.accList.certificate'), icon: 'verified_user', present: true },
  { name: t('detail.accList.raincoat'), icon: 'umbrella', present: false }
])
```

Replace with:

```ts
// Fixed display order for the 13 accessory slots. `key` matches both the
// `detail.accList.*` i18n key and the backend's accessory code exactly.
const ACCESSORY_KEYS = [
  { key: 'box', icon: 'inventory_2' },
  { key: 'dustBag', icon: 'shopping_bag' },
  { key: 'purchaseProof', icon: 'receipt_long' },
  { key: 'shoppingBag', icon: 'shopping_cart' },
  { key: 'shoulderStrap', icon: 'link' },
  { key: 'felt', icon: 'texture' },
  { key: 'pillow', icon: 'chair' },
  { key: 'card', icon: 'credit_card' },
  { key: 'lockKey', icon: 'lock' },
  { key: 'ribbon', icon: 'bookmark' },
  { key: 'brandCard', icon: 'badge' },
  { key: 'certificate', icon: 'verified_user' },
  { key: 'raincoat', icon: 'umbrella' }
]

const accessories = computed(() => {
  const owned = item.value?.accessories ?? []
  return ACCESSORY_KEYS.map(({ key, icon }) => ({
    name: t(`detail.accList.${key}`),
    icon,
    present: owned.includes(key)
  }))
})
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no new errors reported for `src/views/ProductDetailView.vue` (pre-existing errors elsewhere in the repo, if any, are not this task's concern — only confirm no *new* errors point at this file).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds (exit code 0).

- [ ] **Step 5: Manual browser verification**

Run: `npm run dev` (with the local backend running on port 5000, per Task 1).

Navigate to `/product/{id}` for three different inventory IDs and confirm:

1. **Partial accessories** — an ID whose backend record has `accessories` containing some but not all of the 13 codes (e.g. `["box", "card", "certificate"]`): only those 3 tiles render at full opacity; the other 10 render faded (`opacity-30`).
2. **No accessories** — an ID whose backend record has `accessories: ["none"]`: all 13 tiles render faded, none at full opacity.
3. **Missing field** — an ID whose backend record has no `accessories` field at all (`undefined`): all 13 tiles render faded, same as case 2, and the page does not throw/console-error.

Then toggle the locale (EN / 繁中 toggle button in the header) on any of these pages and confirm each tile's label text changes language while the faded/full-opacity state per tile stays the same.

- [ ] **Step 6: Commit**

```bash
git add src/views/ProductDetailView.vue
git commit -m "feat: source accessories display from real API data"
```
