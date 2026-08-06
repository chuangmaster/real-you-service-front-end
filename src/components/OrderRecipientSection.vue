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
  const info = buildDeliveryInfo() as unknown as Record<string, unknown>
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
