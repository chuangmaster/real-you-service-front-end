# Order View Silent Auto-Bind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a customer opens `/order?t={token}` already logged into LINE via LIFF, silently complete the LINE-binding call in the background with no visible UI, instead of requiring a manual button tap; fall back to the existing manual "同意綁定" button whenever login state can't be confirmed.

**Architecture:** Single-file change to `src/views/OrderView.vue`. A new `attemptAutoBind()` function runs after both `fetchOrderSummary()` and `initLiff()` settle (`onMounted` now awaits both via `Promise.all` before calling it). It reuses the exact same `POST /api/public/orders/bind` call `handleBind` already makes, but skips the login-redirect branch entirely and is only invoked when `liff.isLoggedIn()` is already `true`. A new `autoBindInProgress` ref hides the entire bind section in the template while the silent attempt is in flight; on failure (other than a 404, which still means the share link itself is dead) the ref just flips back to `false` and the existing prompt + button reappear with no error text.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, `@line/liff`, axios — no new dependencies.

## Global Constraints

- This repo has no test runner and no lint script (confirmed in `CLAUDE.md`). Verification uses `npm run type-check` (`vue-tsc --noEmit`), `npm run build`, and manual `npm run dev` browser checks — same pattern as `docs/superpowers/plans/2026-07-23-liff-order-view.md`.
- Backend `POST /api/public/orders/bind` is still not live locally as of this plan (per the prior LIFF plan); manual verification can confirm the page still renders its loading/invalid-link states correctly and that the code compiles, but the actual silent-success path can only be confirmed once the backend is deployed and a real `VITE_LIFF_ID` is configured. This is expected, not a bug to chase.
- Auto-bind must NEVER trigger `liff.login()` (the full-page redirect to LINE Login). That redirect stays exclusive to the manual button's `handleBind` path (spec: `docs/superpowers/specs/2026-07-25-order-auto-bind-design.md`).
- A silent auto-bind failure must never set `bindError` or show any error copy, except a 404 response, which must still switch the page to the same "連結已失效" (invalid link) state that `GET /view` 404 produces today.
- No new i18n strings are introduced by this change — do not touch `src/i18n.js`.
- Do not add any client-side memory (e.g. `sessionStorage`) of a permanent bind failure — every mount silently retries once. This was an explicit, deliberate simplification (see spec's "不在此規格範圍內").

---

### Task 1: Add silent auto-bind trigger to OrderView

**Files:**
- Modify: `src/views/OrderView.vue`

**Interfaces:**
- Produces: `autoBindInProgress: Ref<boolean>` — read by the template's bind-section `v-if`. `attemptAutoBind(): Promise<void>` — called once from `onMounted`, no external callers.
- Consumes: existing `summary: Ref<OrderSummary | null>`, `liffReady: Ref<boolean>`, `token: ComputedRef<string | undefined>`, `error: Ref<string>`, `t` (i18n), and the `liff` default export — all already defined earlier in the same file.

- [ ] **Step 1: Add the `autoBindInProgress` ref**

Find this in `src/views/OrderView.vue`:

```ts
// Binding state
const binding = ref(false)
const bindError = ref('')
```

Replace with:

```ts
// Binding state
const binding = ref(false)
const bindError = ref('')
const autoBindInProgress = ref(false)
```

- [ ] **Step 2: Add the `attemptAutoBind` function**

Find this in `src/views/OrderView.vue` (the end of `handleBind`, right before `formatCurrency`):

```ts
const formatCurrency = (amount: number) =>
```

Replace with:

```ts
// Silently completes binding when we already know the customer is logged
// into LINE, so they don't have to tap the button at all. Falls back to
// showing the manual button whenever login state can't be confirmed —
// see docs/superpowers/specs/2026-07-25-order-auto-bind-design.md.
const attemptAutoBind = async () => {
  if (!summary.value || summary.value.isBound) return
  if (!liffReady.value || !liff.isLoggedIn()) return

  autoBindInProgress.value = true
  try {
    const lineIdToken = liff.getIDToken()
    const response = await axios.post('/api/public/orders/bind', {
      t: token.value,
      lineIdToken
    })

    if (response.data && response.data.success) {
      summary.value.isBound = true
    }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response && err.response.status === 404) {
      // Same "invalid link" state as the initial GET /view 404 — the
      // share token itself is no longer valid.
      summary.value = null
      error.value = t('order.errorInvalidLink')
    } else {
      // Silent by design: a failed background attempt just falls back to
      // showing the manual bind button, with no error copy.
      console.error('Silent auto-bind failed:', err)
    }
  } finally {
    autoBindInProgress.value = false
  }
}

const formatCurrency = (amount: number) =>
```

- [ ] **Step 3: Wire `attemptAutoBind` into `onMounted`, and correct the now-stale LIFF comment**

Find this in `src/views/OrderView.vue`:

```ts
// LIFF state — initialized on mount, in parallel with the summary fetch.
// Only required at the moment the customer taps "bind", so a failure here
// doesn't block viewing the order summary.
```

Replace with:

```ts
// LIFF state — initialized on mount, in parallel with the summary fetch.
// A failure here doesn't block viewing the order summary; it only means
// any bind attempt (automatic or manual) later falls back to showing the
// manual button.
```

Then find this at the bottom of the `<script setup>` block:

```ts
onMounted(() => {
  fetchOrderSummary()
  initLiff()
})
```

Replace with:

```ts
onMounted(async () => {
  await Promise.all([fetchOrderSummary(), initLiff()])
  attemptAutoBind()
})
```

- [ ] **Step 4: Hide the bind section during a silent attempt**

Find this in the `<template>` block:

```html
<!-- BIND SECTION -->
<div v-if="!summary.isBound" class="bg-white border border-outline-variant/30 shadow-sm p-6 text-center">
```

Replace with:

```html
<!-- BIND SECTION -->
<div v-if="!summary.isBound && !autoBindInProgress" class="bg-white border border-outline-variant/30 shadow-sm p-6 text-center">
```

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: no errors (exit code 0).

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build succeeds (exit code 0), no new warnings referencing `OrderView.vue`.

- [ ] **Step 7: Manual smoke test of unaffected states**

Run: `npm run dev`, then in a browser open `http://localhost:5173/order?t=anything` (backend isn't live locally, so `GET /view` will 404).

Expected:
- Page briefly shows the loading spinner, then the "連結已失效" (invalid link) error state — same as before this change. This confirms the `onMounted` restructuring (`await Promise.all(...)` before `attemptAutoBind()`) didn't change the error path's behavior or timing in an observable way.
- No console errors other than the existing expected 404 network error logged by axios.

Also open `http://localhost:5173/order` (no `t` param) and confirm it still immediately shows the invalid-link state (the `!token.value` early-return path in `fetchOrderSummary` is unaffected).

- [ ] **Step 8: Commit**

```bash
git add src/views/OrderView.vue
git commit -m "feat: silently auto-bind LINE account when already logged in via LIFF"
```

---

## Follow-up (not part of this plan)

Once the backend's `GET /view` / `POST /bind` endpoints and a real `VITE_LIFF_ID` are available (staging or later), do an end-to-end manual check inside an actual LINE LIFF client: open an unbound order's share link while already logged into LINE and confirm the bind section never flashes before the success state appears, then re-open the same link and confirm it shows the already-bound state with no further network call to `POST /bind` needed (since `GET /view` will now report `isBound: true`).
