# LIFF Member Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a login-gated `/member` page group (profile view/edit, service-order list, sales-order list, and order detail pages) reachable as the LIFF app's main endpoint, reusing the existing LIFF LINE-Login session machinery.

**Architecture:** A new `/member` nested-route group whose parent component (`MemberLayout.vue`) wraps everything in an authorization gate (`MemberGate.vue`) and a responsive tab navigation (`MemberNav.vue`: bottom bar on narrow screens, top bar on `md:`+). Four leaf pages (`ProfileView.vue`, `OrderListView.vue` shared by both order kinds via route meta, `ServiceOrderDetailView.vue`, `SalesOrderDetailView.vue`) call the already-live protected endpoints directly through the existing `sessionHttp` axios instance — no new service/API layer, matching this repo's convention. `SalesOrderDetailView.vue` reuses the existing `OrderRecipientSection.vue` component unmodified.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, `vue-router` (nested routes), `vue-i18n`, `axios` — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-15-liff-member-center-design.md`

## Global Constraints

- This repo has no test runner and no lint script (confirmed in `CLAUDE.md`). Verification uses `npm run type-check` (`vue-tsc --noEmit`), `npm run build`, and manual `npm run dev` browser checks — same pattern as prior plans (e.g. `docs/superpowers/plans/2026-08-06-order-recipient-delivery.md`).
- `OrderKind` is the **string** enum `'Service' | 'Sales'` (confirmed against `http://localhost:5100/swagger/v1/swagger.json`) — never a numeric enum.
- **`GET /api/public/orders` has no `orderKind` filter query parameter today** (confirmed against the live swagger during design). This plan implements the spec's documented fallback as the actual, non-conditional implementation: `OrderListView.vue` fetches the mixed list in pages of `pageSize=100` up to a safety cap of 10 pages (1000 orders), filters by `orderKind` client-side, and paginates *visibility* over the already-fetched, already-filtered array in batches of 20 with **no further network calls** for "load more". This is not gated on backend confirmation — it works against the API as it exists right now. If the backend later adds the filter parameter, switching to it is a separate, out-of-scope follow-up task.
- All protected endpoints go through the existing `sessionHttp` axios instance (`src/composables/useCustomerSession.ts`), which auto-attaches the `Authorization` header and auto-clears the session + sets `exchangeError` to `TOKEN_INVALIDATED` on any 401. New pages in this plan do **not** add their own 401 handling — only `MemberGate.vue` reacts to `exchangeError`, per the spec's "不重複處理 401" rule.
- Order-detail 403 (not owned by this customer) and 404 (does not exist) render the **same** fixed "record not found" message. Never surface backend `message` text anywhere in this plan's error handling.
- Visual tokens: reuse the exact utility classes already established in `src/views/OrderView.vue` / `src/components/OrderRecipientSection.vue` verbatim (card `bg-white border border-outline-variant/30 shadow-sm p-6`; label `font-label-caps text-xs text-secondary uppercase tracking-wider`; value `font-data-mono text-sm text-on-surface` or `font-title-lg text-sm text-on-surface`; primary button `bg-primary text-white ... hover:bg-primary-container transition-colors duration-300 tracking-widest`; icons via `material-symbols-outlined`). Do not invent new styling.
- Desktop-vs-mobile brand mark/locale-toggle placement (an ambiguity the spec left open): mobile shows the small favicon + locale-toggle header exactly as `OrderView.vue` does; desktop's top tab bar (`MemberNav.vue`) carries its own brand wordmark + locale toggle instead of stacking a second top bar under `MemberLayout.vue`'s mobile header. See Task 5.
- All new relative imports in `src/views/member/*.vue` are one directory level deeper than existing top-level views, so they need an extra `../` (e.g. `../../components/OrderStatusBadge.vue`, `../../composables/useCustomerSession`, not `../components/...`).

---

### Task 1: Add `member` i18n namespace

**Files:**
- Modify: `src/i18n.ts` (end of the `en` locale's `order` block, end of the `zh-TW` locale's `order` block)

**Interfaces:**
- Produces: i18n keys `member.gate.{loading,serviceUnavailable,retry}`, `member.nav.{profile,serviceOrders,salesOrders}`, `member.profile.{title,sectionTitle,notProvided,editButton,saveButton,cancelButton,saving,errorGeneric}`, `member.profile.fields.{name,phoneNumber,email,residentialAddress}`, `member.orders.{loadMore,backToList,errorGeneric,errorNotFound}`, `member.orders.service.{title,empty,consignmentStartDate,consignmentEndDate,renewalOption}`, `member.orders.sales.{title,empty,paymentStatus,shippingStatus,subtotalAmount,shippingFee}`, `member.orders.sales.paymentRecords.{heading,paymentDate,paymentAmount,paymentMethod,bankAccountLastFive}` — consumed by every component in Tasks 4–10.
- Consumes: nothing new.

- [ ] **Step 1: Add the English `member` block**

Find this in `src/i18n.ts` (end of the `en` locale's `order` block, right before the `zh-TW` locale starts):

```ts
        validation: {
          required: 'This field is required.'
        }
      }
    }
  },
  'zh-TW': {
```

Replace with:

```ts
        validation: {
          required: 'This field is required.'
        }
      }
    },
    member: {
      gate: {
        loading: 'SIGNING YOU IN...',
        serviceUnavailable: 'Service is temporarily unavailable. Please try again later.',
        retry: 'RETRY'
      },
      nav: {
        profile: 'Profile',
        serviceOrders: 'Service Orders',
        salesOrders: 'Orders'
      },
      profile: {
        title: 'Member Center',
        sectionTitle: 'Profile',
        notProvided: 'Not provided',
        editButton: 'EDIT',
        saveButton: 'SAVE',
        cancelButton: 'CANCEL',
        saving: 'SAVING...',
        errorGeneric: 'Something went wrong. Please try again later.',
        fields: {
          name: 'Name',
          phoneNumber: 'Phone Number',
          email: 'Email',
          residentialAddress: 'Residential Address'
        }
      },
      orders: {
        loadMore: 'LOAD MORE',
        backToList: 'BACK',
        errorGeneric: 'Something went wrong. Please try again later.',
        errorNotFound: 'This record could not be found.',
        service: {
          title: 'Service Orders',
          empty: 'You have no service orders yet.',
          consignmentStartDate: 'Consignment Start Date',
          consignmentEndDate: 'Consignment End Date',
          renewalOption: 'Renewal Option'
        },
        sales: {
          title: 'Orders',
          empty: 'You have no orders yet.',
          paymentStatus: 'Payment Status',
          shippingStatus: 'Shipping Status',
          subtotalAmount: 'Subtotal',
          shippingFee: 'Shipping Fee',
          paymentRecords: {
            heading: 'Payment Records',
            paymentDate: 'Payment Date',
            paymentAmount: 'Amount',
            paymentMethod: 'Payment Method',
            bankAccountLastFive: 'Account Last 5 Digits'
          }
        }
      }
    }
  },
  'zh-TW': {
```

- [ ] **Step 2: Add the Traditional Chinese `member` block**

Find this in `src/i18n.ts` (end of the `zh-TW` locale's `order` block, right before the final closing braces):

```ts
        validation: {
          required: '此欄位為必填。'
        }
      }
    }
  }
}
```

Replace with:

```ts
        validation: {
          required: '此欄位為必填。'
        }
      }
    },
    member: {
      gate: {
        loading: '登入中...',
        serviceUnavailable: '服務暫時無法使用，請稍後再試。',
        retry: '重試'
      },
      nav: {
        profile: '會員資料',
        serviceOrders: '服務單',
        salesOrders: '訂單'
      },
      profile: {
        title: '會員中心',
        sectionTitle: '會員資料',
        notProvided: '未填寫',
        editButton: '編輯',
        saveButton: '儲存',
        cancelButton: '取消',
        saving: '儲存中...',
        errorGeneric: '發生錯誤，請稍候再試。',
        fields: {
          name: '姓名',
          phoneNumber: '手機號碼',
          email: '電子郵件',
          residentialAddress: '戶籍地址'
        }
      },
      orders: {
        loadMore: '載入更多',
        backToList: '返回',
        errorGeneric: '發生錯誤，請稍候再試。',
        errorNotFound: '找不到此筆紀錄。',
        service: {
          title: '服務單記錄',
          empty: '目前沒有服務單記錄。',
          consignmentStartDate: '寄售起始日',
          consignmentEndDate: '寄售到期日',
          renewalOption: '續約選項'
        },
        sales: {
          title: '訂單記錄',
          empty: '目前沒有訂單記錄。',
          paymentStatus: '付款狀態',
          shippingStatus: '出貨狀態',
          subtotalAmount: '小計',
          shippingFee: '運費',
          paymentRecords: {
            heading: '付款紀錄',
            paymentDate: '付款日期',
            paymentAmount: '金額',
            paymentMethod: '付款方式',
            bankAccountLastFive: '帳號末五碼'
          }
        }
      }
    }
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/i18n.ts
git commit -m "feat: add member center i18n strings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Add shared member/order TypeScript types

**Files:**
- Create: `src/types/memberOrders.ts`

**Interfaces:**
- Consumes: `DeliveryMethod`, `DeliveryInfo` from `src/types/orderDelivery.ts` (already exist).
- Produces: `MemberProfile`, `MemberOrderKind`, `OrderListItem`, `OrderListPage`, `MemberOrderItem`, `ServiceOrderDetail`, `PaymentRecord`, `SalesOrderDetail` — consumed by Tasks 7–10.

- [ ] **Step 1: Create the types file**

```ts
// 會員中心（/member）共用的資料型別，對應後端 V3.Public.Api 的
// MemberProfileResponse／CustomerOrderListItemResult／
// CustomerOrderListItemResultPagedResult／CustomerServiceOrderDetailResult／
// CustomerSalesOrderDetailResult（見
// docs/superpowers/specs/2026-08-15-liff-member-center-design.md）。
import type { DeliveryMethod, DeliveryInfo } from './orderDelivery'

export interface MemberProfile {
  customerId: string
  name: string | null
  phoneNumber: string | null
  email: string | null
  residentialAddress: string | null
}

export type MemberOrderKind = 'Service' | 'Sales'

export interface OrderListItem {
  orderId: string
  orderKind: MemberOrderKind
  orderKindDisplay: string | null
  orderNumber: string | null
  status: string | null
  orderDate: string
  totalAmount: number
}

export interface OrderListPage {
  items: OrderListItem[]
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface MemberOrderItem {
  inventoryItemId: string | null
  brand: string | null
  style: string | null
  imageUrl: string | null
  amount: number | null
}

export interface ServiceOrderDetail {
  orderId: string
  orderNumber: string | null
  orderKindDisplay: string | null
  status: string | null
  orderDate: string
  totalAmount: number
  consignmentStartDate: string | null
  consignmentEndDate: string | null
  renewalOption: string | null
  items: MemberOrderItem[]
}

export interface PaymentRecord {
  paymentDate: string
  paymentAmount: number
  paymentMethod: string | null
  bankAccountLastFive: string | null
}

export interface SalesOrderDetail {
  orderId: string
  orderNumber: string | null
  orderDate: string
  subtotalAmount: number
  shippingFee: number
  totalAmount: number
  orderStatus: string | null
  paymentStatus: string | null
  shippingStatus: string | null
  deliveryMethod: DeliveryMethod | null
  deliveryInfo: string | DeliveryInfo | null
  version: number
  items: MemberOrderItem[]
  paymentRecords: PaymentRecord[]
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/memberOrders.ts
git commit -m "feat: add member center TypeScript types

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Add shared currency/date formatting utility

**Files:**
- Create: `src/utils/orderFormat.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatOrderCurrency(amount: number, locale: string): string`, `formatOrderDate(dateStr: string | null, locale: string): string` — consumed by Tasks 8, 9, 10.

- [ ] **Step 1: Create the utility file**

```ts
// 金額／日期格式化共用工具，供 /member 系列頁面重用。行為與
// src/views/OrderView.vue 內既有的同名邏輯保持一致（該檔案本身不從這裡
// 匯入，避免非必要地改動已上線驗證過的檔案）。
export function formatOrderCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0
  }).format(amount)
}

export function formatOrderDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-TW')
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/orderFormat.ts
git commit -m "feat: add shared order currency/date formatting utility

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Create `MemberGate.vue`

**Files:**
- Create: `src/components/MemberGate.vue`

**Interfaces:**
- Consumes: `useCustomerSession()` from `src/composables/useCustomerSession.ts` — `sessionReady: Ref<boolean>`, `exchangeError: Ref<ExchangeError | null>`, `ensureSession(): Promise<string | null>`, `login(): void`, `relogin(): Promise<void>` (all already exist, no changes needed).
- Produces: `MemberGate.vue`, a component with a default `<slot />` that only renders once `sessionReady === true`. Consumed by `MemberLayout.vue` in Task 6.

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCustomerSession } from '../composables/useCustomerSession'

const { t } = useI18n()
const { sessionReady, exchangeError, ensureSession, login, relogin } = useCustomerSession()

// 這兩種 code 代表「重新走一次 LINE 登入就能解決」。MemberGate 跟
// OrderView.vue 不同，不顯示按鈕等使用者點擊，而是偵測到就直接觸發導轉——
// 見設計文件「MemberGate 授權閘門元件」一節。NOT_LOGGED_IN 另外用 if
// 分支直接呼叫 login()（更明確地對應「尚未登入」這個第一次進頁最常見的
// 情境），不與這個陣列合併。
const RELOGIN_CODES = ['INVALID_LINE_TOKEN', 'TOKEN_INVALIDATED']

watch(exchangeError, (err) => {
  if (!err) return
  if (err.code === 'NOT_LOGGED_IN') {
    login()
  } else if (err.code && RELOGIN_CODES.includes(err.code)) {
    relogin()
  }
})

function retry() {
  ensureSession()
}

onMounted(() => {
  ensureSession()
})
</script>

<template>
  <div v-if="sessionReady">
    <slot />
  </div>

  <div
    v-else-if="exchangeError && exchangeError.kind === 'service'"
    class="min-h-screen flex flex-col items-center justify-center text-center px-margin-mobile"
  >
    <span class="material-symbols-outlined text-primary text-[48px] mb-6">gpp_maybe</span>
    <p class="font-body-md text-secondary mb-8">{{ t('member.gate.serviceUnavailable') }}</p>
    <button
      class="bg-primary text-white px-8 py-3 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300"
      @click="retry"
    >
      {{ t('member.gate.retry') }}
    </button>
  </div>

  <!-- Loading, or an identity-class error that's already triggering an
       automatic redirect via the watcher above — both show the same spinner
       while the redirect happens. -->
  <div v-else class="min-h-screen flex flex-col items-center justify-center px-margin-mobile">
    <div class="w-10 h-10 border-2 border-primary-container border-t-primary rounded-full animate-spin mb-6"></div>
    <p class="font-data-mono text-label-caps text-secondary tracking-widest uppercase">{{ t('member.gate.loading') }}</p>
  </div>
</template>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MemberGate.vue
git commit -m "feat: add MemberGate authorization gate component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Create `MemberNav.vue`

**Files:**
- Create: `src/components/MemberNav.vue`

**Interfaces:**
- Consumes: named routes `member-profile`, `member-orders-service`, `member-orders-sales` (defined in Task 11 — this component only references route **names** as strings, so it can be written before the router changes exist; it just won't navigate correctly until Task 11 lands, which is fine since nothing renders it before then).
- Produces: `MemberNav.vue`, a responsive tab navigation. Consumed by `MemberLayout.vue` in Task 6.

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { locale } = useI18n()

const toggleLocale = () => {
  locale.value = locale.value === 'en' ? 'zh-TW' : 'en'
}

interface TabItem {
  name: string
  labelKey: string
  icon: string
}

const TABS: TabItem[] = [
  { name: 'member-profile', labelKey: 'member.nav.profile', icon: 'person' },
  { name: 'member-orders-service', labelKey: 'member.nav.serviceOrders', icon: 'assignment' },
  { name: 'member-orders-sales', labelKey: 'member.nav.salesOrders', icon: 'receipt_long' }
]

// 訂單明細頁（member-orders-service-detail／member-orders-sales-detail）
// 不在 TABS 清單裡，比對不到就回傳 null，畫面上不高亮任何一個分頁——見
// 設計文件「導覽列（響應式）」。
const activeTabName = computed(() => {
  const match = TABS.find((tab) => tab.name === route.name)
  return match ? match.name : null
})
</script>

<template>
  <!-- 窄螢幕：底部固定 Tab Bar -->
  <nav class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-t border-outline-variant/30 flex">
    <router-link
      v-for="tab in TABS"
      :key="tab.name"
      :to="{ name: tab.name }"
      class="flex-1 flex flex-col items-center gap-1 py-3 font-label-caps text-xs tracking-wider transition-colors"
      :class="activeTabName === tab.name ? 'text-primary' : 'text-secondary'"
    >
      <span class="material-symbols-outlined text-[22px]">{{ tab.icon }}</span>
      {{ $t(tab.labelKey) }}
    </router-link>
  </nav>

  <!-- 寬螢幕（md: 以上）：頂部橫向 Tab 列，比照 App.vue 既有 nav bar 的版面，
       並自己帶品牌標記＋語言切換，避免跟 MemberLayout.vue 的行動版頭部重複
       顯示兩條頂部列 -->
  <nav class="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant/30">
    <div class="max-w-container-max mx-auto px-margin-mobile h-16 w-full flex items-center justify-between">
      <span class="brand-logo-nav">REAL YOU</span>
      <div class="flex items-center gap-6">
        <router-link
          v-for="tab in TABS"
          :key="tab.name"
          :to="{ name: tab.name }"
          class="font-label-caps text-xs tracking-wider transition-colors"
          :class="activeTabName === tab.name ? 'text-primary' : 'text-secondary'"
        >
          {{ $t(tab.labelKey) }}
        </router-link>
        <button
          class="font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors border border-outline-variant/30 px-2 py-1 rounded"
          @click="toggleLocale"
        >
          {{ locale === 'en' ? '繁中' : 'EN' }}
        </button>
      </div>
    </div>
  </nav>
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
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MemberNav.vue
git commit -m "feat: add responsive MemberNav tab navigation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Create `MemberLayout.vue`

**Files:**
- Create: `src/views/member/MemberLayout.vue`

**Interfaces:**
- Consumes: `MemberGate.vue` (Task 4), `MemberNav.vue` (Task 5).
- Produces: `MemberLayout.vue`, the route component mounted at `/member` in Task 11 as the parent of all nested member routes.

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MemberGate from '../../components/MemberGate.vue'
import MemberNav from '../../components/MemberNav.vue'

const { locale } = useI18n()

const toggleLocale = () => {
  locale.value = locale.value === 'en' ? 'zh-TW' : 'en'
}
</script>

<template>
  <MemberGate>
    <div class="min-h-screen bg-background flex flex-col relative">
      <!-- 窄螢幕專用的品牌標記＋語言切換（比照 OrderView.vue）。寬螢幕下
           品牌標記與語言切換已整合進 MemberNav.vue 的頂部 Tab 列，這裡隱藏
           避免重複顯示兩條頂部列。 -->
      <button
        class="md:hidden absolute top-6 right-6 z-10 font-label-caps text-xs tracking-wider text-secondary hover:text-primary transition-colors border border-outline-variant/30 px-2 py-1 rounded"
        @click="toggleLocale"
      >
        {{ locale === 'en' ? '繁中' : 'EN' }}
      </button>
      <div class="md:hidden flex justify-center pt-8 pb-4">
        <img src="/favicon.png" alt="REAL YOU" class="w-10 h-10 rounded-xl" />
      </div>

      <MemberNav />

      <!-- pb-20：窄螢幕底部 Tab Bar 的高度緩衝。md:pt-16：寬螢幕頂部 Tab 列
           的高度緩衝（兩者互斥，同一時間只有一個在畫面上）。 -->
      <main class="flex-grow pb-20 md:pb-0 md:pt-16">
        <RouterView />
      </main>
    </div>
  </MemberGate>
</template>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/views/member/MemberLayout.vue
git commit -m "feat: add MemberLayout shell component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Create `ProfileView.vue`

**Files:**
- Create: `src/views/member/ProfileView.vue`

**Interfaces:**
- Consumes: `sessionHttp` from `src/composables/useCustomerSession.ts`; `MemberProfile` type from `src/types/memberOrders.ts` (Task 2); i18n keys from Task 1; `GET /api/public/member/me`, `PATCH /api/public/member/me` (live endpoints, response shape `{ success: boolean, data: MemberProfile }`).
- Produces: `ProfileView.vue`, mounted at route name `member-profile` in Task 11.

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { sessionHttp } from '../../composables/useCustomerSession'
import type { MemberProfile } from '../../types/memberOrders'

const { t } = useI18n()

const loading = ref(true)
const error = ref('')
const profile = ref<MemberProfile | null>(null)

const editing = ref(false)
const saving = ref(false)
const saveError = ref('')
const form = reactive({
  name: '',
  phoneNumber: '',
  email: '',
  residentialAddress: ''
})

async function fetchProfile() {
  loading.value = true
  error.value = ''
  try {
    const response = await sessionHttp.get('/api/public/member/me')
    if (response.data && response.data.success) {
      profile.value = response.data.data
    } else {
      error.value = t('member.profile.errorGeneric')
    }
  } catch (err) {
    console.error('Failed to load member profile:', err)
    error.value = t('member.profile.errorGeneric')
  } finally {
    loading.value = false
  }
}

function startEditing() {
  if (!profile.value) return
  form.name = profile.value.name ?? ''
  form.phoneNumber = profile.value.phoneNumber ?? ''
  form.email = profile.value.email ?? ''
  form.residentialAddress = profile.value.residentialAddress ?? ''
  saveError.value = ''
  editing.value = true
}

function cancelEditing() {
  editing.value = false
  saveError.value = ''
}

async function handleSave() {
  saving.value = true
  saveError.value = ''
  try {
    const response = await sessionHttp.patch('/api/public/member/me', {
      name: form.name,
      phoneNumber: form.phoneNumber,
      email: form.email,
      residentialAddress: form.residentialAddress
    })
    if (response.data && response.data.success) {
      // PATCH 回應直接回傳更新後的完整 profile，不需要重新 GET。
      profile.value = response.data.data
      editing.value = false
    } else {
      saveError.value = t('member.profile.errorGeneric')
    }
  } catch (err) {
    console.error('Failed to save member profile:', err)
    saveError.value = t('member.profile.errorGeneric')
  } finally {
    saving.value = false
  }
}

onMounted(fetchProfile)
</script>

<template>
  <div class="px-margin-mobile py-8 max-w-lg mx-auto w-full">
    <h1 class="font-headline-sm text-lg text-on-surface mb-6">{{ $t('member.profile.title') }}</h1>

    <div v-if="loading" class="flex flex-col items-center justify-center py-16">
      <div class="w-10 h-10 border-2 border-primary-container border-t-primary rounded-full animate-spin"></div>
    </div>

    <div v-else-if="error" class="text-center py-16">
      <span class="material-symbols-outlined text-primary text-[48px] mb-4 block">gpp_maybe</span>
      <p class="font-body-md text-secondary">{{ error }}</p>
    </div>

    <div v-else-if="profile" class="bg-white border border-outline-variant/30 shadow-sm p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.profile.sectionTitle') }}</h2>
        <button
          v-if="!editing"
          type="button"
          class="font-label-caps text-xs text-primary uppercase tracking-wider hover:text-primary-container transition-colors"
          @click="startEditing"
        >
          {{ $t('member.profile.editButton') }}
        </button>
      </div>

      <!-- READ-ONLY -->
      <div v-if="!editing" class="space-y-0">
        <div class="flex justify-between py-4 border-b border-outline-variant/20">
          <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.profile.fields.name') }}</span>
          <span class="font-title-lg text-sm text-on-surface">{{ profile.name || $t('member.profile.notProvided') }}</span>
        </div>
        <div class="flex justify-between py-4 border-b border-outline-variant/20">
          <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.profile.fields.phoneNumber') }}</span>
          <span class="font-data-mono text-sm text-on-surface">{{ profile.phoneNumber || $t('member.profile.notProvided') }}</span>
        </div>
        <div class="flex justify-between py-4 border-b border-outline-variant/20">
          <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.profile.fields.email') }}</span>
          <span class="font-data-mono text-sm text-on-surface">{{ profile.email || $t('member.profile.notProvided') }}</span>
        </div>
        <div class="flex justify-between py-4">
          <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.profile.fields.residentialAddress') }}</span>
          <span class="font-title-lg text-sm text-on-surface text-right">{{ profile.residentialAddress || $t('member.profile.notProvided') }}</span>
        </div>
      </div>

      <!-- EDIT FORM -->
      <div v-else class="space-y-4">
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('member.profile.fields.name') }}</label>
          <input v-model="form.name" type="text" class="w-full border border-outline-variant/30 px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('member.profile.fields.phoneNumber') }}</label>
          <input v-model="form.phoneNumber" type="text" class="w-full border border-outline-variant/30 px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('member.profile.fields.email') }}</label>
          <input v-model="form.email" type="email" class="w-full border border-outline-variant/30 px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('member.profile.fields.residentialAddress') }}</label>
          <input v-model="form.residentialAddress" type="text" class="w-full border border-outline-variant/30 px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary" />
        </div>

        <p v-if="saveError" class="font-body-md text-xs text-primary">{{ saveError }}</p>

        <div class="flex gap-3">
          <button
            type="button"
            class="flex-1 bg-primary text-white px-6 py-3 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="saving"
            @click="handleSave"
          >
            {{ saving ? $t('member.profile.saving') : $t('member.profile.saveButton') }}
          </button>
          <button
            type="button"
            class="flex-1 border border-outline-variant/30 text-secondary px-6 py-3 font-label-caps text-label-caps tracking-widest hover:border-primary hover:text-primary transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="saving"
            @click="cancelEditing"
          >
            {{ $t('member.profile.cancelButton') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/member/ProfileView.vue
git commit -m "feat: add member profile view/edit page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Create `OrderListView.vue`

**Files:**
- Create: `src/views/member/OrderListView.vue`

**Interfaces:**
- Consumes: `sessionHttp` (Task-independent, existing); `OrderStatusBadge.vue` (existing, `props.status: string`); `formatOrderCurrency`/`formatOrderDate` (Task 3); `OrderListItem` type (Task 2); i18n keys (Task 1); route meta field `orderKind: 'Service' | 'Sales'` (set per-route in Task 11) and named routes `member-orders-service-detail` / `member-orders-sales-detail` (Task 11).
- Produces: `OrderListView.vue`, mounted at route names `member-orders-service` and `member-orders-sales` in Task 11 (same component, two route records).

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { sessionHttp } from '../../composables/useCustomerSession'
import OrderStatusBadge from '../../components/OrderStatusBadge.vue'
import { formatOrderCurrency, formatOrderDate } from '../../utils/orderFormat'
import type { OrderListItem, OrderListPage } from '../../types/memberOrders'

const route = useRoute()
const { t, locale } = useI18n()

// route.meta.orderKind 由 router/index.ts 各自的子路由設定（'Service' 或
// 'Sales'），決定這個共用元件這次要顯示哪一種訂單。
const orderKind = computed(() => route.meta.orderKind as 'Service' | 'Sales')
const detailRouteName = computed(() =>
  orderKind.value === 'Service' ? 'member-orders-service-detail' : 'member-orders-sales-detail'
)
const titleKey = computed(() =>
  orderKind.value === 'Service' ? 'member.orders.service.title' : 'member.orders.sales.title'
)
const emptyKey = computed(() =>
  orderKind.value === 'Service' ? 'member.orders.service.empty' : 'member.orders.sales.empty'
)

// GET /api/public/orders 目前沒有 orderKind 篩選參數（見設計文件「相依
// 阻塞」，已在 Global Constraints 確認這是現在就要實作的版本，不是暫時
// 佔位）。這裡整批抓「服務單+訂單」混合清單（最多 MAX_PAGES 頁、每頁
// PAGE_SIZE 筆，對一般客戶的訂單量來說是足夠寬裕的上限），抓齊後在前端
// 依 orderKind 篩選、用 visibleCount 做「載入更多」的純前端分批顯示，
// 過程中不再發送額外的網路請求。待後端補上 orderKind 篩選參數後，可以把
// 這段改回真正依參數分頁的版本（獨立的後續任務，不在本次計畫範圍）。
const PAGE_SIZE = 100
const MAX_PAGES = 10
const BATCH_SIZE = 20

const loading = ref(true)
const error = ref('')
const allItems = ref<OrderListItem[]>([])
const visibleCount = ref(BATCH_SIZE)

const filteredItems = computed(() => allItems.value.filter((item) => item.orderKind === orderKind.value))
const visibleItems = computed(() => filteredItems.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < filteredItems.value.length)

async function fetchOrders() {
  loading.value = true
  error.value = ''
  visibleCount.value = BATCH_SIZE
  const collected: OrderListItem[] = []
  try {
    let pageNumber = 1
    let totalPages = 1
    do {
      const response = await sessionHttp.get('/api/public/orders', {
        params: { pageNumber, pageSize: PAGE_SIZE }
      })
      if (!response.data || !response.data.success) {
        error.value = t('member.orders.errorGeneric')
        return
      }
      const page = response.data.data as OrderListPage
      collected.push(...page.items)
      totalPages = page.totalPages
      pageNumber += 1
    } while (pageNumber <= totalPages && pageNumber <= MAX_PAGES)
    allItems.value = collected
  } catch (err) {
    console.error('Failed to load order list:', err)
    error.value = t('member.orders.errorGeneric')
  } finally {
    loading.value = false
  }
}

function loadMore() {
  visibleCount.value += BATCH_SIZE
}

const formatCurrency = (amount: number) => formatOrderCurrency(amount, locale.value)
const formatDate = (dateStr: string) => formatOrderDate(dateStr, locale.value)

onMounted(fetchOrders)
</script>

<template>
  <div class="px-margin-mobile py-8 max-w-lg mx-auto w-full">
    <h1 class="font-headline-sm text-lg text-on-surface mb-6">{{ $t(titleKey) }}</h1>

    <div v-if="loading" class="flex flex-col items-center justify-center py-16">
      <div class="w-10 h-10 border-2 border-primary-container border-t-primary rounded-full animate-spin"></div>
    </div>

    <div v-else-if="error" class="text-center py-16">
      <span class="material-symbols-outlined text-primary text-[48px] mb-4 block">gpp_maybe</span>
      <p class="font-body-md text-secondary">{{ error }}</p>
    </div>

    <div v-else-if="filteredItems.length === 0" class="text-center py-16">
      <p class="font-body-md text-secondary">{{ $t(emptyKey) }}</p>
    </div>

    <div v-else class="space-y-3">
      <router-link
        v-for="item in visibleItems"
        :key="item.orderId"
        :to="{ name: detailRouteName, params: { id: item.orderId } }"
        class="flex items-center gap-4 bg-white border border-outline-variant/30 shadow-sm p-4 hover:bg-surface-container-low active:bg-surface-container transition-colors"
      >
        <div class="flex-grow">
          <p class="font-data-mono text-xs text-secondary tracking-widest uppercase mb-1">{{ item.orderKindDisplay }}</p>
          <p class="font-title-lg text-sm text-on-surface mb-1">#{{ item.orderNumber }}</p>
          <p class="font-data-mono text-xs text-secondary">{{ formatDate(item.orderDate) }}</p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <OrderStatusBadge :status="item.status ?? ''" />
          <p class="font-data-mono text-sm text-on-surface">{{ formatCurrency(item.totalAmount) }}</p>
        </div>
        <span class="material-symbols-outlined text-secondary text-[20px] flex-shrink-0">chevron_right</span>
      </router-link>

      <button
        v-if="hasMore"
        type="button"
        class="w-full border border-outline-variant/30 text-secondary py-3 font-label-caps text-xs uppercase tracking-wider hover:border-primary hover:text-primary transition-colors"
        @click="loadMore"
      >
        {{ $t('member.orders.loadMore') }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/member/OrderListView.vue
git commit -m "feat: add shared order list view for service/sales orders

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Create `ServiceOrderDetailView.vue`

**Files:**
- Create: `src/views/member/ServiceOrderDetailView.vue`

**Interfaces:**
- Consumes: `sessionHttp`; `OrderStatusBadge.vue`; `formatOrderCurrency`/`formatOrderDate` (Task 3); `ServiceOrderDetail` type (Task 2); i18n keys (Task 1); named route `member-orders-service` (Task 11) for the back link; `GET /api/public/orders/service/{id}`.
- Produces: `ServiceOrderDetailView.vue`, mounted at route name `member-orders-service-detail` in Task 11.

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { sessionHttp } from '../../composables/useCustomerSession'
import OrderStatusBadge from '../../components/OrderStatusBadge.vue'
import { formatOrderCurrency, formatOrderDate } from '../../utils/orderFormat'
import type { ServiceOrderDetail } from '../../types/memberOrders'

const route = useRoute()
const { t, locale } = useI18n()

const orderId = route.params.id as string

const loading = ref(true)
const error = ref('')
const detail = ref<ServiceOrderDetail | null>(null)

async function fetchDetail() {
  loading.value = true
  error.value = ''
  try {
    const response = await sessionHttp.get(`/api/public/orders/service/${orderId}`)
    if (response.data && response.data.success) {
      detail.value = response.data.data
    } else {
      error.value = t('member.orders.errorGeneric')
    }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response && (err.response.status === 403 || err.response.status === 404)) {
      // 403（不屬於此會員）／404（不存在）一律顯示同一種固定文案，不區分
      // 原因——見設計文件「403／404 統一處理」。
      error.value = t('member.orders.errorNotFound')
    } else {
      console.error('Failed to load service order detail:', err)
      error.value = t('member.orders.errorGeneric')
    }
  } finally {
    loading.value = false
  }
}

const formatCurrency = (amount: number) => formatOrderCurrency(amount, locale.value)
const formatDate = (dateStr: string | null) => formatOrderDate(dateStr, locale.value)

onMounted(fetchDetail)
</script>

<template>
  <div class="px-margin-mobile py-8 max-w-lg mx-auto w-full">
    <router-link
      :to="{ name: 'member-orders-service' }"
      class="inline-flex items-center gap-1 font-label-caps text-xs text-secondary uppercase tracking-wider hover:text-primary transition-colors mb-6"
    >
      <span class="material-symbols-outlined text-[18px]">chevron_left</span>
      {{ $t('member.orders.backToList') }}
    </router-link>

    <div v-if="loading" class="flex flex-col items-center justify-center py-16">
      <div class="w-10 h-10 border-2 border-primary-container border-t-primary rounded-full animate-spin"></div>
    </div>

    <div v-else-if="error" class="text-center py-16">
      <span class="material-symbols-outlined text-primary text-[48px] mb-4 block">gpp_maybe</span>
      <p class="font-body-md text-secondary">{{ error }}</p>
    </div>

    <template v-else-if="detail">
      <div class="bg-white border border-outline-variant/30 shadow-sm p-6 mb-8">
        <p class="font-data-mono text-xs text-secondary tracking-widest uppercase mb-1">{{ detail.orderKindDisplay }}</p>
        <h1 class="font-headline-sm text-lg text-on-surface mb-6">#{{ detail.orderNumber }}</h1>

        <div class="space-y-0">
          <div class="flex items-center justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.status') }}</span>
            <OrderStatusBadge :status="detail.status ?? ''" />
          </div>
          <div class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.orderDate') }}</span>
            <span class="font-data-mono text-sm text-on-surface">{{ formatDate(detail.orderDate) }}</span>
          </div>
          <div v-if="detail.consignmentStartDate" class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.orders.service.consignmentStartDate') }}</span>
            <span class="font-data-mono text-sm text-on-surface">{{ formatDate(detail.consignmentStartDate) }}</span>
          </div>
          <div v-if="detail.consignmentEndDate" class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.orders.service.consignmentEndDate') }}</span>
            <span class="font-data-mono text-sm text-on-surface">{{ formatDate(detail.consignmentEndDate) }}</span>
          </div>
          <div v-if="detail.renewalOption" class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.orders.service.renewalOption') }}</span>
            <span class="font-title-lg text-sm text-on-surface">{{ detail.renewalOption }}</span>
          </div>
          <div class="flex justify-between py-4">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.totalAmount') }}</span>
            <span class="font-data-mono text-sm text-on-surface">{{ formatCurrency(detail.totalAmount) }}</span>
          </div>
        </div>
      </div>

      <div>
        <h2 class="font-label-caps text-xs text-secondary uppercase tracking-wider mb-4">{{ $t('order.summary.itemsHeading') }}</h2>
        <div class="space-y-3">
          <template v-for="(orderItem, index) in detail.items" :key="index">
            <!-- 比照 OrderView.vue 既有的品項清單樣式：只有拿得到
                 inventoryItemId 才把整列做成連到鑑定頁面的連結，否則維持
                 純文字顯示。 -->
            <router-link
              v-if="orderItem.inventoryItemId"
              :to="{ name: 'product-detail', params: { id: orderItem.inventoryItemId } }"
              class="flex items-center gap-4 bg-surface-container-low p-4 hover:bg-surface-container active:bg-surface-container transition-colors"
            >
              <div class="w-14 h-14 bg-surface-container overflow-hidden flex-shrink-0 flex items-center justify-center">
                <img v-if="orderItem.imageUrl" :src="orderItem.imageUrl" :alt="orderItem.style ?? ''" class="w-full h-full object-cover" />
                <span v-else class="material-symbols-outlined text-secondary text-[24px]">inventory_2</span>
              </div>
              <div class="flex-grow">
                <p class="font-title-lg text-sm text-on-surface">{{ orderItem.brand }}</p>
                <p class="font-body-md text-xs text-secondary">{{ orderItem.style }}</p>
              </div>
              <p class="font-data-mono text-sm text-on-surface">{{ formatCurrency(orderItem.amount ?? 0) }}</p>
              <span class="material-symbols-outlined text-secondary text-[20px] flex-shrink-0">chevron_right</span>
            </router-link>
            <div v-else class="flex items-center gap-4 bg-surface-container-low p-4">
              <div class="w-14 h-14 bg-surface-container overflow-hidden flex-shrink-0 flex items-center justify-center">
                <img v-if="orderItem.imageUrl" :src="orderItem.imageUrl" :alt="orderItem.style ?? ''" class="w-full h-full object-cover" />
                <span v-else class="material-symbols-outlined text-secondary text-[24px]">inventory_2</span>
              </div>
              <div class="flex-grow">
                <p class="font-title-lg text-sm text-on-surface">{{ orderItem.brand }}</p>
                <p class="font-body-md text-xs text-secondary">{{ orderItem.style }}</p>
              </div>
              <p class="font-data-mono text-sm text-on-surface">{{ formatCurrency(orderItem.amount ?? 0) }}</p>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/member/ServiceOrderDetailView.vue
git commit -m "feat: add service order detail view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Create `SalesOrderDetailView.vue`

**Files:**
- Create: `src/views/member/SalesOrderDetailView.vue`

**Interfaces:**
- Consumes: `sessionHttp`; `OrderStatusBadge.vue`; `OrderRecipientSection.vue` (existing, unmodified — props `detail: SalesOrderDeliveryDetail`, `orderId: string`, emits `updated: [detail: SalesOrderDeliveryDetail]`); `formatOrderCurrency`/`formatOrderDate` (Task 3); `parseSalesOrderDeliveryDetail`, `SalesOrderDeliveryDetail` from `src/types/orderDelivery.ts` (existing); `SalesOrderDetail` type (Task 2); i18n keys (Task 1); named route `member-orders-sales` (Task 11) for the back link; `GET /api/public/orders/sales/{id}`.
- Produces: `SalesOrderDetailView.vue`, mounted at route name `member-orders-sales-detail` in Task 11.

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { sessionHttp } from '../../composables/useCustomerSession'
import OrderStatusBadge from '../../components/OrderStatusBadge.vue'
import OrderRecipientSection from '../../components/OrderRecipientSection.vue'
import { formatOrderCurrency, formatOrderDate } from '../../utils/orderFormat'
import { parseSalesOrderDeliveryDetail, type SalesOrderDeliveryDetail } from '../../types/orderDelivery'
import type { SalesOrderDetail } from '../../types/memberOrders'

const route = useRoute()
const { t, locale } = useI18n()

const orderId = route.params.id as string

const loading = ref(true)
const error = ref('')
const detail = ref<SalesOrderDetail | null>(null)
const deliveryDetail = ref<SalesOrderDeliveryDetail | null>(null)

async function fetchDetail() {
  loading.value = true
  error.value = ''
  try {
    const response = await sessionHttp.get(`/api/public/orders/sales/${orderId}`)
    if (response.data && response.data.success) {
      detail.value = response.data.data
      // deliveryInfo 在後端回應裡實際是 JSON 字串，parseSalesOrderDeliveryDetail
      // 負責轉成正確型別（見 src/types/orderDelivery.ts 頂部說明），不可直接
      // `as` 轉型了事。
      deliveryDetail.value = parseSalesOrderDeliveryDetail(response.data.data)
    } else {
      error.value = t('member.orders.errorGeneric')
    }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response && (err.response.status === 403 || err.response.status === 404)) {
      // 403（不屬於此會員）／404（不存在）一律顯示同一種固定文案，不區分
      // 原因——見設計文件「403／404 統一處理」。
      error.value = t('member.orders.errorNotFound')
    } else {
      console.error('Failed to load sales order detail:', err)
      error.value = t('member.orders.errorGeneric')
    }
  } finally {
    loading.value = false
  }
}

function handleDeliveryUpdated(updated: SalesOrderDeliveryDetail) {
  deliveryDetail.value = updated
}

const formatCurrency = (amount: number) => formatOrderCurrency(amount, locale.value)
const formatDate = (dateStr: string | null) => formatOrderDate(dateStr, locale.value)

onMounted(fetchDetail)
</script>

<template>
  <div class="px-margin-mobile py-8 max-w-lg mx-auto w-full">
    <router-link
      :to="{ name: 'member-orders-sales' }"
      class="inline-flex items-center gap-1 font-label-caps text-xs text-secondary uppercase tracking-wider hover:text-primary transition-colors mb-6"
    >
      <span class="material-symbols-outlined text-[18px]">chevron_left</span>
      {{ $t('member.orders.backToList') }}
    </router-link>

    <div v-if="loading" class="flex flex-col items-center justify-center py-16">
      <div class="w-10 h-10 border-2 border-primary-container border-t-primary rounded-full animate-spin"></div>
    </div>

    <div v-else-if="error" class="text-center py-16">
      <span class="material-symbols-outlined text-primary text-[48px] mb-4 block">gpp_maybe</span>
      <p class="font-body-md text-secondary">{{ error }}</p>
    </div>

    <template v-else-if="detail">
      <div class="bg-white border border-outline-variant/30 shadow-sm p-6 mb-8">
        <h1 class="font-headline-sm text-lg text-on-surface mb-6">#{{ detail.orderNumber }}</h1>

        <div class="space-y-0">
          <div class="flex items-center justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.status') }}</span>
            <OrderStatusBadge :status="detail.orderStatus ?? ''" />
          </div>
          <div class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.orderDate') }}</span>
            <span class="font-data-mono text-sm text-on-surface">{{ formatDate(detail.orderDate) }}</span>
          </div>
          <div class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.orders.sales.paymentStatus') }}</span>
            <span class="font-data-mono text-sm text-on-surface">{{ detail.paymentStatus }}</span>
          </div>
          <div class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.orders.sales.shippingStatus') }}</span>
            <span class="font-data-mono text-sm text-on-surface">{{ detail.shippingStatus }}</span>
          </div>
          <div class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.orders.sales.subtotalAmount') }}</span>
            <span class="font-data-mono text-sm text-on-surface">{{ formatCurrency(detail.subtotalAmount) }}</span>
          </div>
          <div class="flex justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.orders.sales.shippingFee') }}</span>
            <span class="font-data-mono text-sm text-on-surface">{{ formatCurrency(detail.shippingFee) }}</span>
          </div>
          <div class="flex justify-between py-4">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.totalAmount') }}</span>
            <span class="font-data-mono text-sm text-on-surface">{{ formatCurrency(detail.totalAmount) }}</span>
          </div>
        </div>
      </div>

      <div class="mb-8">
        <h2 class="font-label-caps text-xs text-secondary uppercase tracking-wider mb-4">{{ $t('order.summary.itemsHeading') }}</h2>
        <div class="space-y-3">
          <template v-for="(orderItem, index) in detail.items" :key="index">
            <router-link
              v-if="orderItem.inventoryItemId"
              :to="{ name: 'product-detail', params: { id: orderItem.inventoryItemId } }"
              class="flex items-center gap-4 bg-surface-container-low p-4 hover:bg-surface-container active:bg-surface-container transition-colors"
            >
              <div class="w-14 h-14 bg-surface-container overflow-hidden flex-shrink-0 flex items-center justify-center">
                <img v-if="orderItem.imageUrl" :src="orderItem.imageUrl" :alt="orderItem.style ?? ''" class="w-full h-full object-cover" />
                <span v-else class="material-symbols-outlined text-secondary text-[24px]">inventory_2</span>
              </div>
              <div class="flex-grow">
                <p class="font-title-lg text-sm text-on-surface">{{ orderItem.brand }}</p>
                <p class="font-body-md text-xs text-secondary">{{ orderItem.style }}</p>
              </div>
              <p class="font-data-mono text-sm text-on-surface">{{ formatCurrency(orderItem.amount ?? 0) }}</p>
              <span class="material-symbols-outlined text-secondary text-[20px] flex-shrink-0">chevron_right</span>
            </router-link>
            <div v-else class="flex items-center gap-4 bg-surface-container-low p-4">
              <div class="w-14 h-14 bg-surface-container overflow-hidden flex-shrink-0 flex items-center justify-center">
                <img v-if="orderItem.imageUrl" :src="orderItem.imageUrl" :alt="orderItem.style ?? ''" class="w-full h-full object-cover" />
                <span v-else class="material-symbols-outlined text-secondary text-[24px]">inventory_2</span>
              </div>
              <div class="flex-grow">
                <p class="font-title-lg text-sm text-on-surface">{{ orderItem.brand }}</p>
                <p class="font-body-md text-xs text-secondary">{{ orderItem.style }}</p>
              </div>
              <p class="font-data-mono text-sm text-on-surface">{{ formatCurrency(orderItem.amount ?? 0) }}</p>
            </div>
          </template>
        </div>
      </div>

      <div v-if="detail.paymentRecords && detail.paymentRecords.length > 0" class="mb-8">
        <h2 class="font-label-caps text-xs text-secondary uppercase tracking-wider mb-4">{{ $t('member.orders.sales.paymentRecords.heading') }}</h2>
        <div class="space-y-3">
          <div
            v-for="(record, index) in detail.paymentRecords"
            :key="index"
            class="bg-white border border-outline-variant/30 shadow-sm p-4"
          >
            <div class="flex justify-between py-2">
              <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.orders.sales.paymentRecords.paymentDate') }}</span>
              <span class="font-data-mono text-sm text-on-surface">{{ formatDate(record.paymentDate) }}</span>
            </div>
            <div class="flex justify-between py-2">
              <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.orders.sales.paymentRecords.paymentAmount') }}</span>
              <span class="font-data-mono text-sm text-on-surface">{{ formatCurrency(record.paymentAmount) }}</span>
            </div>
            <div v-if="record.paymentMethod" class="flex justify-between py-2">
              <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.orders.sales.paymentRecords.paymentMethod') }}</span>
              <span class="font-title-lg text-sm text-on-surface">{{ record.paymentMethod }}</span>
            </div>
            <div v-if="record.bankAccountLastFive" class="flex justify-between py-2">
              <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('member.orders.sales.paymentRecords.bankAccountLastFive') }}</span>
              <span class="font-data-mono text-sm text-on-surface">{{ record.bankAccountLastFive }}</span>
            </div>
          </div>
        </div>
      </div>

      <OrderRecipientSection
        v-if="deliveryDetail"
        :detail="deliveryDetail"
        :order-id="detail.orderId"
        @updated="handleDeliveryUpdated"
      />
    </template>
  </div>
</template>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/member/SalesOrderDetailView.vue
git commit -m "feat: add sales order detail view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Wire the `/member` route group into the router

**Files:**
- Modify: `src/router/index.ts`

**Interfaces:**
- Consumes: `MemberLayout.vue` (Task 6), `ProfileView.vue` (Task 7), `OrderListView.vue` (Task 8), `ServiceOrderDetailView.vue` (Task 9), `SalesOrderDetailView.vue` (Task 10).
- Produces: named routes `member-profile`, `member-orders-service`, `member-orders-sales`, `member-orders-service-detail`, `member-orders-sales-detail`; `RouteMeta.requiresAuth?: boolean` and `RouteMeta.orderKind?: 'Service' | 'Sales'` type fields.

- [ ] **Step 1: Add the new view imports**

Find this in `src/router/index.ts`:

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
import OrderView from '../views/OrderView.vue'
```

Replace with:

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
import OrderView from '../views/OrderView.vue'
import MemberLayout from '../views/member/MemberLayout.vue'
import ProfileView from '../views/member/ProfileView.vue'
import OrderListView from '../views/member/OrderListView.vue'
import ServiceOrderDetailView from '../views/member/ServiceOrderDetailView.vue'
import SalesOrderDetailView from '../views/member/SalesOrderDetailView.vue'
```

- [ ] **Step 2: Extend the `RouteMeta` type**

Find this in `src/router/index.ts`:

```ts
declare module 'vue-router' {
  interface RouteMeta {
    minimal?: boolean
    title?: string
  }
}
```

Replace with:

```ts
declare module 'vue-router' {
  interface RouteMeta {
    minimal?: boolean
    title?: string
    requiresAuth?: boolean
    orderKind?: 'Service' | 'Sales'
  }
}
```

- [ ] **Step 3: Add the `/member` nested route group**

Find this in `src/router/index.ts`:

```ts
  {
    path: '/order',
    name: 'order',
    component: OrderView,
    meta: { minimal: true, title: 'REAL YOU | 訂單詳情' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
```

Replace with:

```ts
  {
    path: '/order',
    name: 'order',
    component: OrderView,
    meta: { minimal: true, title: 'REAL YOU | 訂單詳情' }
  },
  {
    path: '/member',
    component: MemberLayout,
    meta: { minimal: true, requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'member-profile' } },
      {
        path: 'profile',
        name: 'member-profile',
        component: ProfileView,
        meta: { title: 'REAL YOU | 會員資料' }
      },
      {
        path: 'orders/service',
        name: 'member-orders-service',
        component: OrderListView,
        meta: { orderKind: 'Service', title: 'REAL YOU | 服務單記錄' }
      },
      {
        path: 'orders/sales',
        name: 'member-orders-sales',
        component: OrderListView,
        meta: { orderKind: 'Sales', title: 'REAL YOU | 訂單記錄' }
      },
      {
        path: 'orders/service/:id',
        name: 'member-orders-service-detail',
        component: ServiceOrderDetailView,
        meta: { title: 'REAL YOU | 服務單明細' }
      },
      {
        path: 'orders/sales/:id',
        name: 'member-orders-sales-detail',
        component: SalesOrderDetailView,
        meta: { title: 'REAL YOU | 訂單明細' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
```

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: passes with no errors.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 6: Manual smoke test (no valid session required)**

Run: `npm run dev`, then in a browser open `http://localhost:5173/member`.

Expected: redirected to `/member/profile`; page shows the `member.gate.loading` spinner, then (since there is no LIFF context in a plain desktop browser without a real LINE login) either redirects toward LINE's web login (`access.line.me`) or — if `VITE_LIFF_ID` is unset/invalid in local `.env` — the gate falls into the `service unavailable` branch with a retry button. Either outcome confirms `MemberGate` is correctly blocking unauthenticated access; this step does not require completing a real login.

- [ ] **Step 7: Manual end-to-end test with a real logged-in session**

This step requires a real `VITE_LIFF_ID` in `.env` and a LINE account already bound to a customer with at least one service order and one sales order — obtain these from whoever manages the local backend/LINE channel before running this step.

Run: `npm run dev`, open `http://localhost:5173/member` from a LINE-logged-in context (LIFF client or a browser already authenticated with LINE), and verify:
- Auto-login completes without any manual click, landing on `/member/profile` with real profile data.
- Editing a profile field and saving persists (reflected immediately, and again after a page reload).
- Switching to the "Service Orders" tab and the "Orders" tab shows only the matching `orderKind`, with "LOAD MORE" working if there are more than 20 matching orders.
- Clicking a list row navigates to the matching detail route and shows the same order's items; for a sales order, the recipient info section renders and remains editable under the same rules as `docs/superpowers/specs/2026-08-06-order-recipient-delivery-design.md`.
- Resizing the browser below/above the `md:` breakpoint switches between the bottom tab bar and the top tab bar without losing the current page.
- Manually navigating to `/member/orders/sales/00000000-0000-0000-0000-000000000000` (a non-existent id) shows the "record not found" message, not a raw error.

- [ ] **Step 8: Commit**

```bash
git add src/router/index.ts
git commit -m "feat: wire /member route group into the router

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
