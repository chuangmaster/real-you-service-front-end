# Order Recipient Delivery Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the existing `/order?t={token}` page, once a customer is logged in and their order is bound, show that Sales order's recipient/delivery information, and let them edit it in place when the order status still allows it.

**Architecture:** One new shared types file (`src/types/orderDelivery.ts`), one new self-contained component (`src/components/OrderRecipientSection.vue`) that owns both the read-only display and the in-place edit form for a single order's delivery info, and a focused set of additions to `src/views/OrderView.vue` that fetch the delivery detail (via the already-existing but previously-unused `sessionHttp` authorized axios instance) and render the new component. No new dependencies, no service/API layer — this repo's existing convention is calling axios directly from components/composables (see `docs/superpowers/specs/2026-07-23-liff-order-view-design.md`).

**Tech Stack:** Vue 3 `<script setup lang="ts">`, `vue-i18n`, axios — no new dependencies.

## Global Constraints

- This repo has no test runner and no lint script (confirmed in `CLAUDE.md`). Verification uses `npm run type-check` (`vue-tsc --noEmit`), `npm run build`, and manual `npm run dev` browser checks — same pattern as prior plans (e.g. `docs/superpowers/plans/2026-07-25-order-auto-bind.md`).
- `OrderKind` is the **string** enum `'Service' | 'Sales'` (confirmed against the live `http://localhost:5100/swagger/v1/swagger.json` during design — do NOT treat it as a numeric `0`/`1` enum).
- All `deliveryInfo` fields (`recipientName`, `recipientPhone`, `recipientAddress`, `storeInfo`, `location`) are plain strings — no nested objects.
- Naming trap, confirmed with backend owner: `PICKUP` = 門市自取 (in-store pickup), `STORE_PICKUP` = 超商取貨 (convenience-store pickup). Do not swap these.
- `PickupInfo.pickupTime` is never shown or edited in the v1 form. When submitting a `PICKUP` update, always echo back whatever `pickupTime` value was present on load (`null` if there wasn't one) — never send a new value for it.
- Error copy is fixed per design (`docs/superpowers/specs/2026-08-06-order-recipient-delivery-design.md`): PATCH 400/403/404/500 all show the single generic message; only 409 (`VERSION_CONFLICT`) and 422 (`ORDER_NOT_EDITABLE`, `INVALID_DELIVERY_INFO`) get their own copy. Do not invent extra per-status text.
- Full manual end-to-end verification (editable / non-editable / service-order-hidden scenarios) requires real backend test data — a share-link token for a bound `PLACED` Sales order, one for a non-`PLACED`/`SHIPPED` Sales order, and one for a Service order. This plan cannot supply that data; obtain it from whoever manages the local backend before running the manual verification steps.

---

### Task 1: Add `order.recipient.*` i18n strings

**Files:**
- Modify: `src/i18n.ts:67-101` (en `order` block), `src/i18n.ts:166-200` (zh-TW `order` block)

**Interfaces:**
- Produces: i18n keys `order.recipient.title`, `order.recipient.methods.{HOME_DELIVERY,STORE_PICKUP,PICKUP}`, `order.recipient.fields.{recipientName,recipientPhone,recipientAddress,storeInfo,location}`, `order.recipient.editButton`, `order.recipient.saveButton`, `order.recipient.cancelButton`, `order.recipient.saving`, `order.recipient.errors.{versionConflict,notEditable,invalidInfo,generic}`, `order.recipient.validation.required` — consumed by `OrderRecipientSection.vue` in Task 3.
- Consumes: nothing new.

- [ ] **Step 1: Add the English strings**

Find this in `src/i18n.ts` (end of the `en` locale's `order` block):

```ts
      session: {
        errorIdentity: 'LINE identity verification failed. Please log in to LINE again.',
        errorService: 'Service is temporarily unavailable. Please try again later.',
        retry: 'RETRY',
        bindRequired: 'This LINE account has not been bound yet. Please complete binding via your order link first.'
      }
    }
  },
```

Replace with:

```ts
      session: {
        errorIdentity: 'LINE identity verification failed. Please log in to LINE again.',
        errorService: 'Service is temporarily unavailable. Please try again later.',
        retry: 'RETRY',
        bindRequired: 'This LINE account has not been bound yet. Please complete binding via your order link first.'
      },
      recipient: {
        title: 'Recipient Information',
        methods: {
          HOME_DELIVERY: 'Home Delivery',
          STORE_PICKUP: 'Convenience Store Pickup',
          PICKUP: 'In-Store Pickup'
        },
        fields: {
          recipientName: 'Recipient Name',
          recipientPhone: 'Recipient Phone',
          recipientAddress: 'Recipient Address',
          storeInfo: 'Store Info',
          location: 'Pickup Location'
        },
        editButton: 'EDIT',
        saveButton: 'SAVE',
        cancelButton: 'CANCEL',
        saving: 'SAVING...',
        errors: {
          versionConflict: 'This information was just updated. Please review the latest details and submit again.',
          notEditable: 'This order can no longer have its recipient information changed.',
          invalidInfo: 'Please make sure all recipient information is filled in.',
          generic: 'Something went wrong. Please try again later.'
        },
        validation: {
          required: 'This field is required.'
        }
      }
    }
  },
```

- [ ] **Step 2: Add the Traditional Chinese strings**

Find this in `src/i18n.ts` (end of the `zh-TW` locale's `order` block):

```ts
      session: {
        errorIdentity: 'LINE 身分驗證失敗，請重新登入 LINE。',
        errorService: '服務暫時無法使用，請稍後再試。',
        retry: '重試',
        bindRequired: '此 LINE 帳號尚未完成綁定，請先透過訂單連結完成綁定。'
      }
    }
  }
}
```

Replace with:

```ts
      session: {
        errorIdentity: 'LINE 身分驗證失敗，請重新登入 LINE。',
        errorService: '服務暫時無法使用，請稍後再試。',
        retry: '重試',
        bindRequired: '此 LINE 帳號尚未完成綁定，請先透過訂單連結完成綁定。'
      },
      recipient: {
        title: '收件資訊',
        methods: {
          HOME_DELIVERY: '宅配',
          STORE_PICKUP: '超商取貨',
          PICKUP: '門市自取'
        },
        fields: {
          recipientName: '收件人姓名',
          recipientPhone: '收件人電話',
          recipientAddress: '收件地址',
          storeInfo: '超商門市資訊',
          location: '取貨地點'
        },
        editButton: '編輯',
        saveButton: '儲存',
        cancelButton: '取消',
        saving: '儲存中...',
        errors: {
          versionConflict: '資料已被更新，請重新確認後再提交。',
          notEditable: '此訂單目前狀態已無法修改收件資訊。',
          invalidInfo: '請確認收件資訊填寫完整。',
          generic: '發生錯誤，請稍候再試。'
        },
        validation: {
          required: '此欄位為必填。'
        }
      }
    }
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: no errors (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add src/i18n.ts
git commit -m "i18n: add order.recipient.* strings for recipient info display/edit"
```

---

### Task 2: Add shared delivery types

**Files:**
- Create: `src/types/orderDelivery.ts`

**Interfaces:**
- Produces: `DeliveryMethod`, `HomeDeliveryInfo`, `StorePickupInfo`, `PickupInfo`, `DeliveryInfo`, `SalesOrderDeliveryDetail` — all consumed by `OrderRecipientSection.vue` (Task 3) and `OrderView.vue` (Task 4).
- Consumes: nothing.

- [ ] **Step 1: Create the types file**

Create `src/types/orderDelivery.ts`:

```ts
// 銷售訂單收件資訊相關型別，供 OrderView.vue 與 OrderRecipientSection.vue 共用。
// 三種 deliveryInfo 形狀對應後端 Core/Models/Dtos/CustomerDeliveryInfoDtos.cs。
// 命名提醒：PICKUP = 門市自取，STORE_PICKUP = 超商取貨，容易搞混。
// 見 docs/superpowers/specs/2026-08-06-order-recipient-delivery-design.md
export type DeliveryMethod = 'HOME_DELIVERY' | 'STORE_PICKUP' | 'PICKUP'

export interface HomeDeliveryInfo {
  recipientName: string
  recipientPhone: string
  recipientAddress: string
}

export interface StorePickupInfo {
  storeInfo: string
  recipientName: string
  recipientPhone: string
}

export interface PickupInfo {
  location: string
  pickupTime?: string | null
}

export type DeliveryInfo = HomeDeliveryInfo | StorePickupInfo | PickupInfo

export interface SalesOrderDeliveryDetail {
  orderStatus: string
  shippingStatus: string
  deliveryMethod: DeliveryMethod | null
  deliveryInfo: DeliveryInfo | null
  version: number
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add src/types/orderDelivery.ts
git commit -m "feat: add shared types for sales order delivery info"
```

---

### Task 3: Create `OrderRecipientSection.vue`

**Files:**
- Create: `src/components/OrderRecipientSection.vue`

**Interfaces:**
- Consumes: types from Task 2 (`src/types/orderDelivery.ts`); `sessionHttp` from `src/composables/useCustomerSession.ts` (existing, already-authorized axios instance); i18n keys from Task 1.
- Produces: default-exported component with:
  - Props: `detail: SalesOrderDeliveryDetail`, `orderId: string`
  - Emits: `updated: [detail: SalesOrderDeliveryDetail]`
  - Consumed by `OrderView.vue` in Task 4 as `<OrderRecipientSection :detail="..." :order-id="..." @updated="..." />`

- [ ] **Step 1: Write the component script**

Create `src/components/OrderRecipientSection.vue`:

```vue
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { sessionHttp } from '../composables/useCustomerSession'
import type {
  DeliveryMethod,
  HomeDeliveryInfo,
  StorePickupInfo,
  PickupInfo,
  DeliveryInfo,
  SalesOrderDeliveryDetail
} from '../types/orderDelivery'

const props = defineProps<{
  detail: SalesOrderDeliveryDetail
  orderId: string
}>()

const emit = defineEmits<{
  updated: [detail: SalesOrderDeliveryDetail]
}>()

const { t } = useI18n()

const METHODS: DeliveryMethod[] = ['HOME_DELIVERY', 'STORE_PICKUP', 'PICKUP']

// 只有 orderStatus === 'PLACED' 且尚未出貨才可編輯，
// 第二個條件是防禦性檢查（見設計文件）。
const isEditable = computed(
  () => props.detail.orderStatus === 'PLACED' && props.detail.shippingStatus !== 'SHIPPED'
)

// ---- 唯讀顯示 ----

const readOnlyFields = computed<{ labelKey: string; value: string }[]>(() => {
  const info = props.detail.deliveryInfo
  const method = props.detail.deliveryMethod
  if (!info || !method) return []

  if (method === 'HOME_DELIVERY') {
    const d = info as HomeDeliveryInfo
    return [
      { labelKey: 'order.recipient.fields.recipientName', value: d.recipientName },
      { labelKey: 'order.recipient.fields.recipientPhone', value: d.recipientPhone },
      { labelKey: 'order.recipient.fields.recipientAddress', value: d.recipientAddress }
    ]
  }
  if (method === 'STORE_PICKUP') {
    const d = info as StorePickupInfo
    return [
      { labelKey: 'order.recipient.fields.storeInfo', value: d.storeInfo },
      { labelKey: 'order.recipient.fields.recipientName', value: d.recipientName },
      { labelKey: 'order.recipient.fields.recipientPhone', value: d.recipientPhone }
    ]
  }
  const d = info as PickupInfo
  return [{ labelKey: 'order.recipient.fields.location', value: d.location }]
})

// ---- 編輯表單狀態 ----

const editing = ref(false)
const saving = ref(false)
const formError = ref('')
const formMethod = ref<DeliveryMethod>('HOME_DELIVERY')
const fieldErrors = reactive<Record<string, boolean>>({})

// 各方式各自獨立的欄位緩衝區，這樣編輯過程中在方式之間切換不會互相污染。
const homeDeliveryForm = reactive<HomeDeliveryInfo>({
  recipientName: '',
  recipientPhone: '',
  recipientAddress: ''
})
const storePickupForm = reactive<StorePickupInfo>({
  storeInfo: '',
  recipientName: '',
  recipientPhone: ''
})
const pickupForm = reactive<{ location: string }>({ location: '' })
// 從載入資料原樣保留，v1 表單不編輯，送出時原樣帶回，避免覆蓋成 null。
let pickupTimeOnLoad: string | null = null

function clearFieldErrors() {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])
}

function startEditing() {
  formError.value = ''
  clearFieldErrors()

  const method = props.detail.deliveryMethod ?? 'HOME_DELIVERY'
  formMethod.value = method
  const info = props.detail.deliveryInfo

  if (method === 'HOME_DELIVERY' && info) {
    const d = info as HomeDeliveryInfo
    homeDeliveryForm.recipientName = d.recipientName
    homeDeliveryForm.recipientPhone = d.recipientPhone
    homeDeliveryForm.recipientAddress = d.recipientAddress
  }
  if (method === 'STORE_PICKUP' && info) {
    const d = info as StorePickupInfo
    storePickupForm.storeInfo = d.storeInfo
    storePickupForm.recipientName = d.recipientName
    storePickupForm.recipientPhone = d.recipientPhone
  }
  if (method === 'PICKUP' && info) {
    const d = info as PickupInfo
    pickupForm.location = d.location
    pickupTimeOnLoad = d.pickupTime ?? null
  }

  editing.value = true
}

function cancelEditing() {
  editing.value = false
  formError.value = ''
}

// 編輯中切換收件方式時，清空新方式底下的欄位——不嘗試在不同方式間映射欄位值。
function selectMethod(method: DeliveryMethod) {
  if (formMethod.value === method) return
  formMethod.value = method
  if (method === 'HOME_DELIVERY') {
    homeDeliveryForm.recipientName = ''
    homeDeliveryForm.recipientPhone = ''
    homeDeliveryForm.recipientAddress = ''
  }
  if (method === 'STORE_PICKUP') {
    storePickupForm.storeInfo = ''
    storePickupForm.recipientName = ''
    storePickupForm.recipientPhone = ''
  }
  if (method === 'PICKUP') {
    pickupForm.location = ''
    pickupTimeOnLoad = null
  }
}

function buildDeliveryInfo(): DeliveryInfo {
  if (formMethod.value === 'HOME_DELIVERY') {
    return {
      recipientName: homeDeliveryForm.recipientName.trim(),
      recipientPhone: homeDeliveryForm.recipientPhone.trim(),
      recipientAddress: homeDeliveryForm.recipientAddress.trim()
    }
  }
  if (formMethod.value === 'STORE_PICKUP') {
    return {
      storeInfo: storePickupForm.storeInfo.trim(),
      recipientName: storePickupForm.recipientName.trim(),
      recipientPhone: storePickupForm.recipientPhone.trim()
    }
  }
  return {
    location: pickupForm.location.trim(),
    pickupTime: pickupTimeOnLoad
  }
}

function requiredKeysFor(method: DeliveryMethod): string[] {
  if (method === 'HOME_DELIVERY') return ['recipientName', 'recipientPhone', 'recipientAddress']
  if (method === 'STORE_PICKUP') return ['storeInfo', 'recipientName', 'recipientPhone']
  return ['location']
}

// 前端只做必填非空的提前擋錯，不重建後端完整驗證規則
// （見設計文件「不在此規格範圍內」）。
function validate(): boolean {
  clearFieldErrors()
  const info = buildDeliveryInfo() as Record<string, unknown>
  let valid = true

  for (const key of requiredKeysFor(formMethod.value)) {
    const value = info[key]
    if (typeof value !== 'string' || value.length === 0) {
      fieldErrors[key] = true
      valid = false
    }
  }

  return valid
}

async function refetchDetail(): Promise<void> {
  const response = await sessionHttp.get(`/api/public/orders/sales/${props.orderId}`)
  if (response.data && response.data.success) {
    emit('updated', response.data.data as SalesOrderDeliveryDetail)
  }
}

async function handleSave() {
  formError.value = ''
  if (!validate()) {
    formError.value = t('order.recipient.errors.invalidInfo')
    return
  }

  saving.value = true
  try {
    const response = await sessionHttp.patch(
      `/api/public/orders/sales/${props.orderId}/delivery`,
      {
        deliveryMethod: formMethod.value,
        deliveryInfo: buildDeliveryInfo(),
        version: props.detail.version
      }
    )

    if (response.data && response.data.success) {
      const updated = response.data.data as {
        deliveryMethod: DeliveryMethod
        deliveryInfo: DeliveryInfo
        version: number
      }
      emit('updated', {
        orderStatus: props.detail.orderStatus,
        shippingStatus: props.detail.shippingStatus,
        deliveryMethod: updated.deliveryMethod,
        deliveryInfo: updated.deliveryInfo,
        version: updated.version
      })
      editing.value = false
    } else {
      formError.value = t('order.recipient.errors.generic')
    }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const status = err.response.status
      const code = (err.response.data as { code?: string } | undefined)?.code

      if (status === 409 && code === 'VERSION_CONFLICT') {
        formError.value = t('order.recipient.errors.versionConflict')
        // 重抓最新資料覆蓋 props.detail（透過 emit('updated', ...)），
        // 但不重新呼叫 startEditing()，讓使用者已輸入的內容留在畫面上，
        // 自行對照最新資料後再按一次儲存。
        await refetchDetail()
      } else if (status === 422 && code === 'ORDER_NOT_EDITABLE') {
        formError.value = t('order.recipient.errors.notEditable')
        await refetchDetail()
        editing.value = false
      } else if (status === 422 && code === 'INVALID_DELIVERY_INFO') {
        formError.value = t('order.recipient.errors.invalidInfo')
      } else {
        // 400（ValidationProblemDetails，無 code）／403／404／其他非預期狀態碼
        formError.value = t('order.recipient.errors.generic')
      }
    } else {
      formError.value = t('order.recipient.errors.generic')
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="bg-white border border-outline-variant/30 shadow-sm p-6 mb-8">
    <div class="flex items-center justify-between mb-6">
      <h2 class="font-label-caps text-xs text-secondary uppercase tracking-wider">
        {{ $t('order.recipient.title') }}
      </h2>
      <button
        v-if="isEditable && !editing"
        type="button"
        class="font-label-caps text-xs text-primary uppercase tracking-wider hover:text-primary-container transition-colors"
        @click="startEditing"
      >
        {{ $t('order.recipient.editButton') }}
      </button>
    </div>

    <!-- READ-ONLY -->
    <div v-if="!editing" class="space-y-0">
      <div
        v-for="field in readOnlyFields"
        :key="field.labelKey"
        class="flex justify-between py-4 border-b border-outline-variant/20 last:border-b-0"
      >
        <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t(field.labelKey) }}</span>
        <span class="font-data-mono text-sm text-on-surface text-right">{{ field.value }}</span>
      </div>
    </div>

    <!-- EDIT FORM -->
    <div v-else class="space-y-5">
      <div class="flex gap-2">
        <button
          v-for="method in METHODS"
          :key="method"
          type="button"
          class="flex-1 px-3 py-2 font-label-caps text-xs uppercase tracking-wider border transition-colors"
          :class="formMethod === method
            ? 'bg-primary text-white border-primary'
            : 'bg-white text-secondary border-outline-variant/30 hover:border-primary'"
          @click="selectMethod(method)"
        >
          {{ $t(`order.recipient.methods.${method}`) }}
        </button>
      </div>

      <div v-if="formMethod === 'HOME_DELIVERY'" class="space-y-4">
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('order.recipient.fields.recipientName') }}</label>
          <input
            v-model="homeDeliveryForm.recipientName"
            type="text"
            class="w-full border px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary"
            :class="fieldErrors.recipientName ? 'border-error' : 'border-outline-variant/30'"
          />
        </div>
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('order.recipient.fields.recipientPhone') }}</label>
          <input
            v-model="homeDeliveryForm.recipientPhone"
            type="text"
            class="w-full border px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary"
            :class="fieldErrors.recipientPhone ? 'border-error' : 'border-outline-variant/30'"
          />
        </div>
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('order.recipient.fields.recipientAddress') }}</label>
          <input
            v-model="homeDeliveryForm.recipientAddress"
            type="text"
            class="w-full border px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary"
            :class="fieldErrors.recipientAddress ? 'border-error' : 'border-outline-variant/30'"
          />
        </div>
      </div>

      <div v-else-if="formMethod === 'STORE_PICKUP'" class="space-y-4">
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('order.recipient.fields.storeInfo') }}</label>
          <input
            v-model="storePickupForm.storeInfo"
            type="text"
            class="w-full border px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary"
            :class="fieldErrors.storeInfo ? 'border-error' : 'border-outline-variant/30'"
          />
        </div>
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('order.recipient.fields.recipientName') }}</label>
          <input
            v-model="storePickupForm.recipientName"
            type="text"
            class="w-full border px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary"
            :class="fieldErrors.recipientName ? 'border-error' : 'border-outline-variant/30'"
          />
        </div>
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('order.recipient.fields.recipientPhone') }}</label>
          <input
            v-model="storePickupForm.recipientPhone"
            type="text"
            class="w-full border px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary"
            :class="fieldErrors.recipientPhone ? 'border-error' : 'border-outline-variant/30'"
          />
        </div>
      </div>

      <div v-else class="space-y-4">
        <div>
          <label class="font-label-caps text-xs text-secondary uppercase tracking-wider block mb-1">{{ $t('order.recipient.fields.location') }}</label>
          <input
            v-model="pickupForm.location"
            type="text"
            class="w-full border px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary"
            :class="fieldErrors.location ? 'border-error' : 'border-outline-variant/30'"
          />
        </div>
      </div>

      <p v-if="formError" class="font-body-md text-xs text-primary">{{ formError }}</p>

      <div class="flex gap-3">
        <button
          type="button"
          class="flex-1 bg-primary text-white px-6 py-3 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="saving"
          @click="handleSave"
        >
          {{ saving ? $t('order.recipient.saving') : $t('order.recipient.saveButton') }}
        </button>
        <button
          type="button"
          class="flex-1 border border-outline-variant/30 text-secondary px-6 py-3 font-label-caps text-label-caps tracking-widest hover:border-primary hover:text-primary transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="saving"
          @click="cancelEditing"
        >
          {{ $t('order.recipient.cancelButton') }}
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors (exit code 0).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds (exit code 0). The component isn't referenced anywhere yet, so this only confirms it compiles standalone — visual verification happens in Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/components/OrderRecipientSection.vue
git commit -m "feat: add OrderRecipientSection component for recipient info display/edit"
```

---

### Task 4: Wire `OrderRecipientSection` into `OrderView.vue`

**Files:**
- Modify: `src/views/OrderView.vue`

**Interfaces:**
- Consumes: `OrderRecipientSection` (Task 3), `SalesOrderDeliveryDetail` type (Task 2), `sessionHttp` (existing, `src/composables/useCustomerSession.ts`).
- Produces: no new external interface — this is the integration point.

- [ ] **Step 1: Add new imports**

Find this in `src/views/OrderView.vue`:

```ts
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import liff from '@line/liff'
import OrderStatusBadge from '../components/OrderStatusBadge.vue'
import { useCustomerSession } from '../composables/useCustomerSession'
```

Replace with:

```ts
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import liff from '@line/liff'
import OrderStatusBadge from '../components/OrderStatusBadge.vue'
import OrderRecipientSection from '../components/OrderRecipientSection.vue'
import { sessionHttp, useCustomerSession } from '../composables/useCustomerSession'
import type { SalesOrderDeliveryDetail } from '../types/orderDelivery'
```

- [ ] **Step 2: Extend the `OrderSummary` interface**

Find this in `src/views/OrderView.vue`:

```ts
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
```

Replace with:

```ts
interface OrderSummary {
  orderId: string
  orderKind: 'Service' | 'Sales'
  orderNumber: string
  orderKindDisplay: string
  status: string
  orderDate: string
  customerName: string
  totalAmount: number
  items: OrderItem[]
  isBound: boolean
}
```

- [ ] **Step 3: Read `sessionReady` from the session composable**

Find this in `src/views/OrderView.vue`:

```ts
const { isLiffLoggedIn, exchangeError, ensureSession, login } = useCustomerSession()
```

Replace with:

```ts
const { sessionReady, isLiffLoggedIn, exchangeError, ensureSession, login } = useCustomerSession()
```

- [ ] **Step 4: Add delivery detail state and fetch function**

Find this in `src/views/OrderView.vue`:

```ts
// Binding state
const binding = ref(false)
const bindError = ref('')
const autoBindInProgress = ref(false)
```

Replace with:

```ts
// Binding state
const binding = ref(false)
const bindError = ref('')
const autoBindInProgress = ref(false)

// Recipient/delivery detail state — only fetched for bound Sales orders once
// the customer has a valid session JWT. Silent-failure by design, same as
// attemptAutoBind's non-404 failures: the section just doesn't appear.
// See docs/superpowers/specs/2026-08-06-order-recipient-delivery-design.md.
const deliveryDetail = ref<SalesOrderDeliveryDetail | null>(null)

const maybeFetchDeliveryDetail = async () => {
  if (!summary.value) return
  if (summary.value.orderKind !== 'Sales') return
  if (!summary.value.isBound || !sessionReady.value) return

  try {
    const response = await sessionHttp.get(`/api/public/orders/sales/${summary.value.orderId}`)
    if (response.data && response.data.success) {
      deliveryDetail.value = response.data.data as SalesOrderDeliveryDetail
    }
  } catch (err) {
    console.error('Failed to load delivery detail:', err)
  }
}
```

- [ ] **Step 5: Call `maybeFetchDeliveryDetail()` after a manual bind succeeds**

Find this in `src/views/OrderView.vue` (inside `handleBind`):

```ts
    if (response.data && response.data.success) {
      summary.value.isBound = true
    } else {
      bindError.value = t('order.errorServer')
    }
```

Replace with:

```ts
    if (response.data && response.data.success) {
      summary.value.isBound = true
      maybeFetchDeliveryDetail()
    } else {
      bindError.value = t('order.errorServer')
    }
```

- [ ] **Step 6: Call `maybeFetchDeliveryDetail()` after a silent auto-bind succeeds**

Find this in `src/views/OrderView.vue` (inside `attemptAutoBind`):

```ts
    if (response.data && response.data.success) {
      summary.value.isBound = true
    }
  } catch (err) {
```

Replace with:

```ts
    if (response.data && response.data.success) {
      summary.value.isBound = true
      maybeFetchDeliveryDetail()
    }
  } catch (err) {
```

- [ ] **Step 7: Call `maybeFetchDeliveryDetail()` on initial mount**

Find this in `src/views/OrderView.vue`:

```ts
onMounted(async () => {
  await Promise.all([fetchOrderSummary(), ensureSession()])
  try {
    isInLiffClient.value = liff.isInClient()
  } catch {
    isInLiffClient.value = false
  }
  attemptAutoBind()
})
```

Replace with:

```ts
onMounted(async () => {
  await Promise.all([fetchOrderSummary(), ensureSession()])
  try {
    isInLiffClient.value = liff.isInClient()
  } catch {
    isInLiffClient.value = false
  }
  attemptAutoBind()
  maybeFetchDeliveryDetail()
})
```

This covers the case where the order was already bound before this page visit (so `summary.value.isBound` is already `true` straight from the initial `GET /view` response) — `maybeFetchDeliveryDetail()`'s own guard makes this a no-op otherwise, and the calls added in Steps 5–6 cover the "just got bound during this visit" cases.

- [ ] **Step 8: Render the new component in the template**

Find this in `src/views/OrderView.vue`:

```html
      <!-- BIND SECTION -->
      <div v-if="!summary.isBound && !autoBindInProgress" class="bg-white border border-outline-variant/30 shadow-sm p-6 text-center">
```

Replace with:

```html
      <OrderRecipientSection
        v-if="deliveryDetail"
        :detail="deliveryDetail"
        :order-id="summary.orderId"
        @updated="deliveryDetail = $event"
      />

      <!-- BIND SECTION -->
      <div v-if="!summary.isBound && !autoBindInProgress" class="bg-white border border-outline-variant/30 shadow-sm p-6 text-center">
```

- [ ] **Step 9: Type-check**

Run: `npm run type-check`
Expected: no errors (exit code 0).

- [ ] **Step 10: Build**

Run: `npm run build`
Expected: build succeeds (exit code 0), no new warnings referencing `OrderView.vue` or `OrderRecipientSection.vue`.

- [ ] **Step 11: Manual smoke test of unaffected states**

Run: `npm run dev`, then in a browser open `http://localhost:5173/order?t=anything` (an unknown token 404s at `GET /view`).

Expected:
- Page shows the loading spinner, then the "連結已失效" (invalid link) error state — same as before this change.
- No console errors other than the existing expected 404 network error logged by axios.

This confirms the new code paths (`deliveryDetail`, `maybeFetchDeliveryDetail`) don't interfere with the existing error/loading states when there's no valid order to load.

- [ ] **Step 12: Manual end-to-end test with real order data**

Requires backend test data per this plan's Global Constraints (a bound `PLACED`-status Sales order's share token, a non-editable Sales order's share token, and a Service order's share token). With `npm run dev` running and pointed at the local backend (`http://localhost:5100`):

1. Open the `PLACED` Sales order's link, log in via LIFF if prompted. Expected: "收件資訊" card appears below the items list, showing the current delivery method and fields, with an "編輯" button visible.
2. Click "編輯". Expected: the same card switches to the form in place — method selector plus the fields for the currently-selected method, pre-filled with the existing values.
3. Switch to a different delivery method in the selector. Expected: the field set below changes, and those fields start empty.
4. Leave a required field blank and click "儲存". Expected: inline "此欄位為必填" style error styling (red border) appears on the empty field(s), and the card stays in edit mode with the "請確認收件資訊填寫完整" message shown.
5. Fill in all required fields and click "儲存". Expected: request succeeds, card returns to read-only mode showing the newly-saved values.
6. Click "編輯" again, change a field, and click "取消". Expected: card returns to read-only mode showing the original (unsaved) values — the cancel discards the edit.
7. Open the non-editable Sales order's link (status not `PLACED`, or already `SHIPPED`). Expected: "收件資訊" card appears in read-only mode with no "編輯" button.
8. Open the Service order's link. Expected: no "收件資訊" card appears at all.

- [ ] **Step 13: Commit**

```bash
git add src/views/OrderView.vue
git commit -m "feat: show and allow editing recipient info on the order page"
```

---

## Self-Review Notes

- **Spec coverage:** all sections of `docs/superpowers/specs/2026-08-06-order-recipient-delivery-design.md` are covered — OrderKind gating (Task 4 Step 4), three fetch trigger points (Task 4 Steps 5–7), new types (Task 2), read-only + edit UI (Task 3), method-switch support (Task 3's `selectMethod`), 409/422/error-code handling table (Task 3's `handleSave` catch block), i18n additions (Task 1), and the manual verification scenarios (Task 4 Step 12).
- **Type consistency:** `SalesOrderDeliveryDetail`, `DeliveryMethod`, `HomeDeliveryInfo`, `StorePickupInfo`, `PickupInfo`, `DeliveryInfo` are defined once in Task 2 and imported (never redefined) in Tasks 3 and 4. The `OrderRecipientSection` prop names (`detail`, `orderId`) and emit signature (`updated: [detail: SalesOrderDeliveryDetail]`) match exactly between Task 3's `defineProps`/`defineEmits` and Task 4's template usage (`:detail`, `:order-id`, `@updated`).
- **No placeholders:** every step includes full, exact code — no "add validation" or "handle errors" left unwritten.
