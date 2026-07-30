# Order Status Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw, untranslated `PENDING`/`COMPLETED`/`CANCELLED` status string on the `/order` view with a localized, color-coded badge component.

**Architecture:** A new presentational component `OrderStatusBadge.vue` maps a raw API status string to an i18n key and a fixed Tailwind color-class string via a lookup table, then renders a pill badge matching the existing "AUTHENTIC" badge style in `ProductDetailView.vue`. `OrderView.vue` swaps its raw `{{ summary.status }}` interpolation for `<OrderStatusBadge :status="summary.status" />`.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, vue-i18n, Tailwind CSS. No test runner exists in this project (`npm run type-check` via `vue-tsc --noEmit` is the only automated check) — verification is manual, via the dev server.

## Global Constraints

- English labels: `PENDING` → "Processing", `COMPLETED` → "Completed", `CANCELLED` → "Cancelled".
- Traditional Chinese labels: `PENDING` → "處理中", `COMPLETED` → "已完成", `CANCELLED` → "已取消".
- Colors reuse existing palette only: `PENDING` → `primary`, `COMPLETED` → `authentic-emerald`, `CANCELLED` → `error`, unknown status → `secondary` (and displays the raw string, not a missing-translation key).
- Tailwind class names must appear as complete, literal strings in the source (no `bg-${color}/10` interpolation), otherwise Tailwind's build-time class scanner won't pick them up.
- Badge visual style follows `src/views/ProductDetailView.vue:399-401`: pill shape, `bg-{color}/10` + `border-{color}/20`, `text-{color}`, `font-label-caps text-sm uppercase`.
- Both `en` and `zh-TW` entries in `src/i18n.ts` must be updated together — there is no separate translation-loading mechanism.

---

### Task 1: Add i18n keys for order status labels

**Files:**
- Modify: `src/i18n.ts:67-91` (the `en.order` block) and `src/i18n.ts:155-178` (the `zh-TW.order` block)

**Interfaces:**
- Produces: i18n keys `order.status.pending`, `order.status.completed`, `order.status.cancelled` (both locales) — consumed by Task 2's `OrderStatusBadge.vue`.

- [ ] **Step 1: Add the `status` block to the `en.order` object**

In `src/i18n.ts`, inside the `en` locale's `order` object, insert a `status` key right after `closeWindow` and before `summary`:

```js
    order: {
      loading: 'RETRIEVING ORDER DETAILS...',
      errorInvalidLink: 'This order link is invalid or has expired.',
      errorServer: 'Unable to load order details. Please try again later.',
      closeWindow: 'CLOSE',
      status: {
        pending: 'Processing',
        completed: 'Completed',
        cancelled: 'Cancelled'
      },
      summary: {
```

- [ ] **Step 2: Add the `status` block to the `zh-TW.order` object**

In the same file, inside the `zh-TW` locale's `order` object, insert the matching block right after `closeWindow` and before `summary`:

```js
    order: {
      loading: '正在讀取訂單資料...',
      errorInvalidLink: '此訂單連結無效或已過期。',
      errorServer: '無法載入訂單資料，請稍後再試。',
      closeWindow: '關閉視窗',
      status: {
        pending: '處理中',
        completed: '已完成',
        cancelled: '已取消'
      },
      summary: {
```

- [ ] **Step 3: Verify with the TypeScript compiler**

Run: `npm run type-check`
Expected: no errors (this is a plain object literal change, so this mainly guards against a stray syntax typo like a missing comma).

- [ ] **Step 4: Commit**

```bash
git add src/i18n.ts
git commit -m "feat: add i18n keys for order status labels"
```

---

### Task 2: Create the `OrderStatusBadge` component

**Files:**
- Create: `src/components/OrderStatusBadge.vue`

**Interfaces:**
- Consumes: i18n keys `order.status.pending` / `.completed` / `.cancelled` (from Task 1).
- Produces: a Vue SFC default-exported as a component accepting `{ status: string }` as its only prop — consumed by Task 3 in `OrderView.vue` as `<OrderStatusBadge :status="summary.status" />`.

- [ ] **Step 1: Write the component**

Create `src/components/OrderStatusBadge.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  status: string
}>()

const { t } = useI18n()

// Tailwind's class scanner needs full literal class strings — building
// these with string interpolation (e.g. `bg-${color}/10`) would silently
// drop them from the production build.
const STATUS_STYLES: Record<string, { labelKey: string; colorClass: string }> = {
  PENDING: {
    labelKey: 'order.status.pending',
    colorClass: 'text-primary bg-primary/10 border-primary/20'
  },
  COMPLETED: {
    labelKey: 'order.status.completed',
    colorClass: 'text-authentic-emerald bg-authentic-emerald/10 border-authentic-emerald/20'
  },
  CANCELLED: {
    labelKey: 'order.status.cancelled',
    colorClass: 'text-error bg-error/10 border-error/20'
  }
}

const FALLBACK_COLOR_CLASS = 'text-secondary bg-secondary/10 border-secondary/20'

const style = computed(() => STATUS_STYLES[props.status])

const label = computed(() => (style.value ? t(style.value.labelKey) : props.status))
const colorClass = computed(() => style.value?.colorClass ?? FALLBACK_COLOR_CLASS)
</script>

<template>
  <span
    class="inline-flex items-center px-3 py-1 rounded-full border font-label-caps text-sm uppercase whitespace-nowrap"
    :class="colorClass"
  >
    {{ label }}
  </span>
</template>
```

- [ ] **Step 2: Verify with the TypeScript compiler**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/OrderStatusBadge.vue
git commit -m "feat: add OrderStatusBadge component"
```

---

### Task 3: Wire the badge into `OrderView.vue`

**Files:**
- Modify: `src/views/OrderView.vue:1-27` (script imports) and `src/views/OrderView.vue:259` (template)

**Interfaces:**
- Consumes: `OrderStatusBadge` component from Task 2 (`src/components/OrderStatusBadge.vue`), prop `status: string`.

- [ ] **Step 1: Import the component**

In `src/views/OrderView.vue`, add the import alongside the existing imports at the top of `<script setup lang="ts">` (after the `liff` import on line 6):

```ts
import liff from '@line/liff'
import OrderStatusBadge from '../components/OrderStatusBadge.vue'
```

- [ ] **Step 2: Replace the raw status interpolation in the template**

Find this block at `src/views/OrderView.vue:257-260`:

```html
          <div class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.status') }}</span>
            <span class="font-title-lg text-sm text-on-surface">{{ summary.status }}</span>
          </div>
```

Replace the second `<span>` with the badge component:

```html
          <div class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.status') }}</span>
            <OrderStatusBadge :status="summary.status" />
          </div>
```

- [ ] **Step 3: Verify with the TypeScript compiler**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 4: Manually verify in the dev server**

Run: `npm run dev`

Since `GET /api/public/orders/view` requires a live backend and a valid `t` token, temporarily hardcode a fake `summary.value` for a manual check rather than standing up the backend. In `src/views/OrderView.vue`, inside `fetchOrderSummary`, temporarily add right after `loading.value = true` (revert before committing):

```ts
  summary.value = {
    orderNumber: 'TEST-001',
    orderKindDisplay: 'Test Order',
    status: 'PENDING',
    orderDate: new Date().toISOString(),
    customerName: 'Test Customer',
    totalAmount: 1000,
    items: [],
    isBound: true
  }
  loading.value = false
  return
```

Open `http://localhost:5173/order?t=anything` and confirm:
- Status field shows a gold pill badge reading "Processing" (or "處理中" depending on locale).
- Toggling the locale button (top-right) switches the badge text between "Processing" and "處理中" without a page reload.
- Manually change the hardcoded `status` value to `'COMPLETED'` → green badge, "Completed"/"已完成".
- Change it to `'CANCELLED'` → red badge, "Cancelled"/"已取消".
- Change it to an unrecognized value like `'REFUNDED'` → gray badge, displays the literal string `REFUNDED` (not a broken i18n key).

Once confirmed, **remove the temporary hardcoded block** so `fetchOrderSummary` goes back to calling the real API.

- [ ] **Step 5: Commit**

```bash
git add src/views/OrderView.vue
git commit -m "feat: render order status as a localized badge"
```
