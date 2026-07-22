# LIFF Order View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new customer-facing `/order?t={token}` page that shows an order summary fetched from the (not-yet-live) public API, and lets an unbound customer bind their LINE account via LIFF LINE Login so future order updates can be pushed automatically.

**Architecture:** A new minimal-layout route (`/order`) bypasses the app's existing nav bar/footer via a `route.meta.minimal` flag checked in `App.vue`. The new `OrderView.vue` component follows the existing `ProductDetailView.vue` conventions: axios calls inline in the component (no service layer), fixed i18n copy per error class (never the raw backend message), and a simple ref-based state machine (`loading` / `error` / `summary`). LINE Login is handled via the official `@line/liff` SDK, initialized on mount in parallel with the summary fetch, and only required at the moment the customer taps "bind."

**Tech Stack:** Vue 3 `<script setup lang="ts">`, vue-router, vue-i18n, axios, `@line/liff` (new dependency). No test runner exists in this repo.

## Global Constraints

- This repo has no test runner and no lint script (spec: `docs/superpowers/specs/2026-07-23-liff-order-view-design.md`, and confirmed in `CLAUDE.md`). Verification steps use `npm run type-check` (`vue-tsc --noEmit`), `npm run build`, and manual `npm run dev` browser checks — the same pattern as `docs/superpowers/plans/2026-07-21-accessories-api-integration.md`.
- Backend `GET /api/public/orders/view` and `POST /api/public/orders/bind` are **not implemented yet**. Local manual verification will observe error states (invalid link / server error), not successful data — this is expected, not a bug to chase.
- Error messages must never pass through the backend's raw `message` text. Map HTTP status / `code` to fixed i18n strings only, exactly like `detail.error404` / `detail.errorServer` in the existing `ProductDetailView.vue`.
- `GET /view` returning 404 and `POST /bind` returning 404 must produce the identical "invalid link" UI state — never attempt to distinguish the underlying reason (spec is explicit that the backend deliberately collapses all failure reasons into one response).
- The `/order` route must render without the site's existing nav bar and footer (`route.meta.minimal`).
- `VITE_LIFF_ID` must never have a real value committed to the repo; `.env` must be gitignored, only `.env.example` (with an empty placeholder) is committed.

---

### Task 1: Add the LIFF SDK dependency and env var scaffolding

**Files:**
- Modify: `package.json` (add `@line/liff` dependency)
- Modify: `.gitignore` (add `.env`)
- Create: `.env.example`
- Modify: `src/vite-env.d.ts` (type `import.meta.env.VITE_LIFF_ID`)

**Interfaces:**
- Produces: `import.meta.env.VITE_LIFF_ID: string`, typed and available to any component in later tasks. The `liff` default export from `@line/liff` becomes available for import in later tasks.

- [ ] **Step 1: Install `@line/liff`**

Run: `npm install @line/liff@^2.29.1`

Expected: `package.json`'s `dependencies` gains `"@line/liff": "^2.29.1"`, and `package-lock.json` updates. No other files change.

- [ ] **Step 2: Add `.env` to `.gitignore`**

Find this section in `.gitignore`:

```
node_modules
dist
dist-ssr
*.local
```

Replace with:

```
node_modules
dist
dist-ssr
*.local
.env
```

- [ ] **Step 3: Create `.env.example`**

Create `/Users/zander/Repository/real-you-service-front-end/.env.example` with:

```
# LINE LIFF Channel ID for the /order LINE-binding page.
# Obtain the real value from whoever owns the REAL YOU LINE official account,
# then copy this file to .env (gitignored) and fill it in locally.
VITE_LIFF_ID=
```

- [ ] **Step 4: Type the new env var**

Find `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
```

Replace with:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIFF_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
```

- [ ] **Step 5: Type-check and build**

Run: `npm run type-check`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds (exit code 0).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example src/vite-env.d.ts
git commit -m "chore: add LIFF SDK dependency and VITE_LIFF_ID env scaffolding"
```

---

### Task 2: Add the `/order` route with a minimal (no nav/footer) layout

**Files:**
- Modify: `src/router/index.ts`
- Create: `src/views/OrderView.vue` (placeholder content; replaced in full by Task 3)
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: nothing new — plain Vue Router + existing `App.vue` structure.
- Produces: a `minimal` boolean on `RouteMeta` (module-augmented in `src/router/index.ts`) that `App.vue` reads via `route.meta.minimal` to decide whether to render the nav bar and footer. Task 3 depends on this route already existing and on `App.vue` already skipping the site chrome for it.

- [ ] **Step 1: Add the route and augment `RouteMeta`**

Find `src/router/index.ts`:

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/product/:id',
    name: 'product-detail',
    component: ProductDetailView
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
```

Replace with:

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
import OrderView from '../views/OrderView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    minimal?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/product/:id',
    name: 'product-detail',
    component: ProductDetailView
  },
  {
    path: '/order',
    name: 'order',
    component: OrderView,
    meta: { minimal: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
```

- [ ] **Step 2: Create a placeholder `OrderView.vue`**

Create `src/views/OrderView.vue`:

```vue
<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <p class="font-body-md text-secondary">Order view placeholder</p>
  </div>
</template>
```

(This is replaced with the full implementation in Task 3 — its only job here is to prove the route and minimal layout work.)

- [ ] **Step 3: Make `App.vue` skip the nav/footer for minimal routes**

Find `src/App.vue`:

```vue
<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const toggleLocale = () => {
  locale.value = locale.value === 'en' ? 'zh-TW' : 'en'
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background text-on-background font-body-md overflow-x-hidden">
    <!-- Navbar -->
    <nav class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant/30">
      <div class="max-w-container-max mx-auto px-margin-mobile h-16 flex items-center justify-between">
        <router-link to="/" class="brand-logo-nav hover:opacity-80 transition-opacity">
          REAL YOU
        </router-link>
        <div class="flex items-center gap-6">
          <router-link to="/" class="font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors">
            {{ $t('nav.searchReport') }}
          </router-link>
          <button @click="toggleLocale" class="font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors border border-outline-variant/30 px-2 py-1 rounded hover:border-primary">
            {{ locale === 'en' ? '繁中' : 'EN' }}
          </button>
          <button class="material-symbols-outlined text-secondary hover:text-primary transition-colors">menu</button>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="flex-grow pt-16">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="bg-charcoal text-white/60 py-12 border-t border-white/5 mt-auto">
      <div class="max-w-container-max mx-auto px-margin-mobile flex flex-col md:flex-row justify-between items-center gap-8">
        <span class="brand-logo-footer">REAL YOU</span>
        <div class="flex gap-8 font-label-caps text-[10px] tracking-widest uppercase">
          <a
            class="hover:text-primary-container transition-colors"
            href="https://realyou.com.tw/blogs/精品服務/realyou-safe_shopping"
            target="_blank"
            rel="noopener noreferrer"
          >{{ $t('footer.privacy') }}</a>
          <a
            class="hover:text-primary-container transition-colors"
            href="https://realyou.com.tw/pages/線上收購服務-免到店-快速鑑定報價24hr撥款"
            target="_blank"
            rel="noopener noreferrer"
          >{{ $t('footer.terms') }}</a>
          <a
            class="hover:text-primary-container transition-colors"
            href="https://realyou.com.tw/blogs/精品服務/authentication"
            target="_blank"
            rel="noopener noreferrer"
          >{{ $t('footer.appraisal') }}</a>
        </div>
        <p class="font-data-mono text-[10px]">
          {{ $t('footer.copyright') }}
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.brand-logo-nav {
  font-family: "AFuturaOrto", sans-serif;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 5px;
  color: var(--v3-sidebar-menu-active-text-color);
  line-height: 1;
  white-space: nowrap;
  text-transform: uppercase;
}

.brand-logo-footer {
  font-family: "AFuturaOrto", sans-serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 5px;
  color: var(--v3-sidebar-menu-active-text-color);
  line-height: 1;
  white-space: nowrap;
  text-transform: uppercase;
}
</style>
```

Replace with:

```vue
<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { locale } = useI18n()

const toggleLocale = () => {
  locale.value = locale.value === 'en' ? 'zh-TW' : 'en'
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background text-on-background font-body-md overflow-x-hidden">
    <!-- Navbar -->
    <nav v-if="!route.meta.minimal" class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant/30">
      <div class="max-w-container-max mx-auto px-margin-mobile h-16 flex items-center justify-between">
        <router-link to="/" class="brand-logo-nav hover:opacity-80 transition-opacity">
          REAL YOU
        </router-link>
        <div class="flex items-center gap-6">
          <router-link to="/" class="font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors">
            {{ $t('nav.searchReport') }}
          </router-link>
          <button @click="toggleLocale" class="font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors border border-outline-variant/30 px-2 py-1 rounded hover:border-primary">
            {{ locale === 'en' ? '繁中' : 'EN' }}
          </button>
          <button class="material-symbols-outlined text-secondary hover:text-primary transition-colors">menu</button>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="flex-grow" :class="{ 'pt-16': !route.meta.minimal }">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer v-if="!route.meta.minimal" class="bg-charcoal text-white/60 py-12 border-t border-white/5 mt-auto">
      <div class="max-w-container-max mx-auto px-margin-mobile flex flex-col md:flex-row justify-between items-center gap-8">
        <span class="brand-logo-footer">REAL YOU</span>
        <div class="flex gap-8 font-label-caps text-[10px] tracking-widest uppercase">
          <a
            class="hover:text-primary-container transition-colors"
            href="https://realyou.com.tw/blogs/精品服務/realyou-safe_shopping"
            target="_blank"
            rel="noopener noreferrer"
          >{{ $t('footer.privacy') }}</a>
          <a
            class="hover:text-primary-container transition-colors"
            href="https://realyou.com.tw/pages/線上收購服務-免到店-快速鑑定報價24hr撥款"
            target="_blank"
            rel="noopener noreferrer"
          >{{ $t('footer.terms') }}</a>
          <a
            class="hover:text-primary-container transition-colors"
            href="https://realyou.com.tw/blogs/精品服務/authentication"
            target="_blank"
            rel="noopener noreferrer"
          >{{ $t('footer.appraisal') }}</a>
        </div>
        <p class="font-data-mono text-[10px]">
          {{ $t('footer.copyright') }}
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.brand-logo-nav {
  font-family: "AFuturaOrto", sans-serif;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 5px;
  color: var(--v3-sidebar-menu-active-text-color);
  line-height: 1;
  white-space: nowrap;
  text-transform: uppercase;
}

.brand-logo-footer {
  font-family: "AFuturaOrto", sans-serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 5px;
  color: var(--v3-sidebar-menu-active-text-color);
  line-height: 1;
  white-space: nowrap;
  text-transform: uppercase;
}
</style>
```

- [ ] **Step 4: Type-check and build**

Run: `npm run type-check`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds (exit code 0).

- [ ] **Step 5: Manual browser verification**

Run: `npm run dev`, then in a browser:

1. Visit `/` and `/product/{any-id}` — confirm the nav bar and footer still render exactly as before.
2. Visit `/order` — confirm there is **no** nav bar and **no** footer, just the centered "Order view placeholder" text with no large top gap (the `pt-16` padding should be absent).

- [ ] **Step 6: Commit**

```bash
git add src/router/index.ts src/views/OrderView.vue src/App.vue
git commit -m "feat: add /order route with minimal no-chrome layout"
```

---

### Task 3: Implement the order summary + LIFF LINE-binding page

**Files:**
- Modify: `src/i18n.ts` (add `order` namespace to both `en` and `zh-TW`)
- Modify: `src/views/OrderView.vue` (full implementation, replacing the Task 2 placeholder)

**Interfaces:**
- Consumes: `import.meta.env.VITE_LIFF_ID` (Task 1), the `/order` route with `route.query.t` (Task 2), the default export of `@line/liff` (Task 1's dependency).
- Produces: nothing consumed by later tasks — this is the final leaf component for this feature.

- [ ] **Step 1: Add the `order` i18n namespace (English)**

Find this in `src/i18n.ts`, inside the `en` object, right after the `footer` key closes (i.e. insert `order` as a new top-level sibling of `nav` / `home` / `detail` / `footer` inside `en`):

```ts
    footer: {
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      appraisal: 'Authentication Service',
      copyright: '© 2026 REAL YOU. ALL RIGHTS RESERVED.'
    }
  },
```

Replace with:

```ts
    footer: {
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      appraisal: 'Authentication Service',
      copyright: '© 2026 REAL YOU. ALL RIGHTS RESERVED.'
    },
    order: {
      loading: 'RETRIEVING ORDER DETAILS...',
      errorInvalidLink: 'This order link is invalid or has expired.',
      errorServer: 'Unable to load order details. Please try again later.',
      closeWindow: 'CLOSE',
      summary: {
        status: 'Status',
        orderDate: 'Order Date',
        customerName: 'Customer',
        totalAmount: 'Total Amount',
        itemsHeading: 'Items'
      },
      bind: {
        prompt: 'Agree to bind your LINE account to automatically receive updates about this order.',
        button: 'BIND LINE ACCOUNT',
        submitting: 'BINDING...',
        success: 'Your LINE account is now bound. You will receive updates about this order automatically.',
        errorLiffUnavailable: 'LINE service is temporarily unavailable. Please try again later.',
        errors: {
          invalidLineToken: 'LINE login verification failed. Please log in to LINE again and retry.',
          lineAlreadyBound: 'This LINE account is already bound to another customer. Please contact customer service for help.',
          customerAlreadyBound: 'This customer has already completed LINE binding. To switch accounts, please contact your sales representative.'
        }
      }
    }
  },
```

- [ ] **Step 2: Add the `order` i18n namespace (Traditional Chinese)**

Find this in `src/i18n.ts`, inside the `'zh-TW'` object, right after its `footer` key closes:

```ts
    footer: {
      privacy: '精品安心購保證',
      terms: '線上收購服務',
      appraisal: '精品鑑定',
      copyright: '© 2026 REAL YOU。版權所有。'
    }
  }
}
```

Replace with:

```ts
    footer: {
      privacy: '精品安心購保證',
      terms: '線上收購服務',
      appraisal: '精品鑑定',
      copyright: '© 2026 REAL YOU。版權所有。'
    },
    order: {
      loading: '正在讀取訂單資料...',
      errorInvalidLink: '此訂單連結無效或已過期。',
      errorServer: '無法載入訂單資料，請稍後再試。',
      closeWindow: '關閉視窗',
      summary: {
        status: '狀態',
        orderDate: '訂單日期',
        customerName: '客戶',
        totalAmount: '總金額',
        itemsHeading: '品項'
      },
      bind: {
        prompt: '同意綁定您的 LINE 帳號，之後訂單狀態將自動透過 LINE 通知您。',
        button: '綁定 LINE 帳號',
        submitting: '綁定中...',
        success: '已完成 LINE 綁定，之後訂單狀態將自動透過 LINE 通知您。',
        errorLiffUnavailable: 'LINE 服務暫時無法使用，請稍後再試。',
        errors: {
          invalidLineToken: 'LINE 登入驗證失敗，請重新登入 LINE 後再試一次。',
          lineAlreadyBound: '此 LINE 帳號已綁定給另一位客戶，請聯絡客服協助處理。',
          customerAlreadyBound: '此客戶已完成過綁定，如需更換 LINE 帳號請聯絡業務/客服協助。'
        }
      }
    }
  }
}
```

- [ ] **Step 3: Replace the placeholder `OrderView.vue` with the full implementation**

Replace the entire contents of `src/views/OrderView.vue` with:

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import liff from '@line/liff'

interface OrderItem {
  brand: string
  style: string
  imageUrl: string | null
  amount: number
}

interface OrderSummary {
  orderNumber: string
  orderKindDisplay: string
  status: string
  orderDate: string
  customerName: string
  totalAmount: number
  items: OrderItem[]
  isBound: boolean
}

const route = useRoute()
const { t, locale } = useI18n()

const token = computed(() => {
  const raw = route.query.t
  return typeof raw === 'string' ? raw : undefined
})

const toggleLocale = () => {
  locale.value = locale.value === 'en' ? 'zh-TW' : 'en'
}

// Order summary state
const loading = ref(true)
const error = ref('')
const summary = ref<OrderSummary | null>(null)

const fetchOrderSummary = async () => {
  if (!token.value) {
    error.value = t('order.errorInvalidLink')
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''
  try {
    const response = await axios.get('/api/public/orders/view', {
      params: { t: token.value }
    })
    if (response.data && response.data.success) {
      summary.value = response.data.data
    } else {
      error.value = t('order.errorServer')
    }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response && err.response.status === 404) {
      error.value = t('order.errorInvalidLink')
    } else {
      error.value = t('order.errorServer')
    }
  } finally {
    loading.value = false
  }
}

// LIFF state — initialized on mount, in parallel with the summary fetch.
// Only required at the moment the customer taps "bind", so a failure here
// doesn't block viewing the order summary.
const liffReady = ref(false)
const isInLiffClient = ref(false)

const initLiff = async () => {
  try {
    await liff.init({ liffId: import.meta.env.VITE_LIFF_ID })
    liffReady.value = true
    isInLiffClient.value = liff.isInClient()
  } catch (err) {
    console.error('Failed to initialize LIFF:', err)
    liffReady.value = false
  }
}

const closeLiffWindow = () => {
  liff.closeWindow()
}

// Binding state
const binding = ref(false)
const bindError = ref('')

const handleBind = async () => {
  if (binding.value || !summary.value) return

  bindError.value = ''

  if (!liffReady.value) {
    bindError.value = t('order.bind.errorLiffUnavailable')
    return
  }

  binding.value = true
  try {
    if (!liff.isLoggedIn()) {
      // Redirects the whole page to LINE Login and back to this same URL
      // (including the `t` query param); execution does not continue past this call.
      liff.login({ redirectUri: window.location.href })
      return
    }

    const lineIdToken = liff.getIDToken()
    const response = await axios.post('/api/public/orders/bind', {
      t: token.value,
      lineIdToken
    })

    if (response.data && response.data.success) {
      summary.value.isBound = true
    } else {
      bindError.value = t('order.errorServer')
    }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const status = err.response.status
      const code = err.response.data?.code

      if (status === 404) {
        // Same "invalid link" state as the initial GET /view 404 — the
        // share token itself is no longer valid.
        summary.value = null
        error.value = t('order.errorInvalidLink')
      } else if (code === 'INVALID_LINE_TOKEN') {
        bindError.value = t('order.bind.errors.invalidLineToken')
      } else if (code === 'LINE_ALREADY_BOUND') {
        bindError.value = t('order.bind.errors.lineAlreadyBound')
      } else if (code === 'CUSTOMER_ALREADY_BOUND') {
        bindError.value = t('order.bind.errors.customerAlreadyBound')
      } else {
        bindError.value = t('order.errorServer')
      }
    } else {
      bindError.value = t('order.errorServer')
    }
  } finally {
    binding.value = false
  }
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat(locale.value === 'en' ? 'en-US' : 'zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0
  }).format(amount)

const formattedTotalAmount = computed(() =>
  summary.value ? formatCurrency(summary.value.totalAmount) : ''
)

const formattedOrderDate = computed(() => {
  if (!summary.value || !summary.value.orderDate) return ''
  return new Date(summary.value.orderDate).toLocaleDateString(locale.value === 'en' ? 'en-US' : 'zh-TW')
})

onMounted(() => {
  fetchOrderSummary()
  initLiff()
})
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col relative">
    <button
      @click="toggleLocale"
      class="absolute top-6 right-6 z-10 font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors border border-outline-variant/30 px-2 py-1 rounded"
    >
      {{ locale === 'en' ? '繁中' : 'EN' }}
    </button>

    <div class="flex justify-center pt-8 pb-4">
      <img src="/favicon.png" alt="REAL YOU" class="w-10 h-10 rounded-xl" />
    </div>

    <!-- LOADING -->
    <div v-if="loading" class="flex-grow flex flex-col items-center justify-center px-margin-mobile">
      <div class="w-10 h-10 border-2 border-primary-container border-t-primary rounded-full animate-spin mb-6"></div>
      <p class="font-data-mono text-label-caps text-secondary tracking-widest uppercase">
        {{ $t('order.loading') }}
      </p>
    </div>

    <!-- ERROR -->
    <div v-else-if="error" class="flex-grow flex flex-col items-center justify-center text-center px-margin-mobile max-w-md mx-auto">
      <span class="material-symbols-outlined text-primary text-[48px] mb-6">gpp_maybe</span>
      <p class="font-body-md text-secondary mb-8">{{ error }}</p>
      <button
        v-if="isInLiffClient"
        @click="closeLiffWindow"
        class="bg-primary text-white px-8 py-3 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300"
      >
        {{ $t('order.closeWindow') }}
      </button>
    </div>

    <!-- SUMMARY -->
    <div v-else-if="summary" class="flex-grow px-margin-mobile pb-16 max-w-lg mx-auto w-full">
      <div class="bg-white border border-outline-variant/30 shadow-sm p-6 mb-8">
        <p class="font-data-mono text-xs text-secondary tracking-widest uppercase mb-1">{{ summary.orderKindDisplay }}</p>
        <h1 class="font-headline-sm text-lg text-on-surface mb-6">#{{ summary.orderNumber }}</h1>

        <div class="space-y-0">
          <div class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.status') }}</span>
            <span class="font-title-lg text-sm text-on-surface">{{ summary.status }}</span>
          </div>
          <div class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.orderDate') }}</span>
            <span class="font-data-mono text-sm text-on-surface">{{ formattedOrderDate }}</span>
          </div>
          <div class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.customerName') }}</span>
            <span class="font-title-lg text-sm text-on-surface">{{ summary.customerName }}</span>
          </div>
          <div class="flex justify-between py-4">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.totalAmount') }}</span>
            <span class="font-data-mono text-sm text-on-surface">{{ formattedTotalAmount }}</span>
          </div>
        </div>
      </div>

      <div class="mb-8">
        <h2 class="font-label-caps text-xs text-secondary uppercase tracking-wider mb-4">{{ $t('order.summary.itemsHeading') }}</h2>
        <div class="space-y-3">
          <div
            v-for="(orderItem, index) in summary.items"
            :key="index"
            class="flex items-center gap-4 bg-surface-container-low p-4"
          >
            <div class="w-14 h-14 bg-surface-container overflow-hidden flex-shrink-0 flex items-center justify-center">
              <img v-if="orderItem.imageUrl" :src="orderItem.imageUrl" :alt="orderItem.style" class="w-full h-full object-cover" />
              <span v-else class="material-symbols-outlined text-secondary text-[24px]">inventory_2</span>
            </div>
            <div class="flex-grow">
              <p class="font-title-lg text-sm text-on-surface">{{ orderItem.brand }}</p>
              <p class="font-body-md text-xs text-secondary">{{ orderItem.style }}</p>
            </div>
            <p class="font-data-mono text-sm text-on-surface">{{ formatCurrency(orderItem.amount) }}</p>
          </div>
        </div>
      </div>

      <!-- BIND SECTION -->
      <div v-if="!summary.isBound" class="bg-white border border-outline-variant/30 shadow-sm p-6 text-center">
        <p class="font-body-md text-sm text-secondary mb-5">{{ $t('order.bind.prompt') }}</p>
        <p v-if="bindError" class="font-body-md text-xs text-primary mb-4">{{ bindError }}</p>
        <button
          class="w-full bg-primary text-white px-8 py-4 font-label-caps text-label-caps hover:bg-primary-container transition-colors duration-300 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="binding"
          @click="handleBind"
        >
          {{ binding ? $t('order.bind.submitting') : $t('order.bind.button') }}
        </button>
      </div>
      <div v-else class="bg-authentic-emerald/10 border border-authentic-emerald/20 p-6 text-center">
        <span class="material-symbols-outlined text-authentic-emerald text-[32px] mb-2 block">check_circle</span>
        <p class="font-body-md text-sm text-on-surface">{{ $t('order.bind.success') }}</p>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Type-check and build**

Run: `npm run type-check`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds (exit code 0).

- [ ] **Step 5: Manual browser verification**

Run: `npm run dev` (backend does not need to be running for these checks — the point is to confirm the frontend handles "no backend yet" gracefully).

1. Visit `/order` (no `t` param) — confirm it immediately shows the "invalid link" error message (no loading spinner, no network request in devtools).
2. Visit `/order?t=test123` — confirm a brief loading spinner, then (since the backend endpoint doesn't exist / isn't running) either an "invalid link" or "unable to load" error message appears, with no unhandled exception in the console.
3. Confirm the locale toggle button (top-right corner) switches all visible text between `繁中` and `EN`.
4. Confirm no nav bar or footer render on this route (carried over from Task 2).
5. Open browser devtools console and confirm the LIFF init failure (expected, since `VITE_LIFF_ID` is empty in `.env.example`/unset) logs a caught `console.error` — not an unhandled promise rejection or a crash that blocks the rest of the page from rendering.

- [ ] **Step 6: Commit**

```bash
git add src/i18n.ts src/views/OrderView.vue
git commit -m "feat: implement LIFF order summary and LINE-binding view"
```
