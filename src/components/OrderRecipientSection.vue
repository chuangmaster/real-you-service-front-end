<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { sessionHttp } from '../composables/useCustomerSession'
import { parseSalesOrderDeliveryDetail } from '../types/orderDelivery'
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

  // 第一列固定顯示收件方式本身的翻譯名稱（設計文件「收件方式中文名稱」）。
  // 沒有現成的「收件方式」欄位標籤可用（Task 1 只新增了 order.recipient.methods.*
  // 這組值本身，未新增對應的欄位標籤 key），且不可在此新增新的 i18n key，
  // 因此這一列不搭配 labelKey（labelKey 留空，範本端會略過渲染標籤），
  // 讓收件方式名稱本身獨立成一列、以較醒目的樣式呈現。
  const methodField = { labelKey: '', value: t(`order.recipient.methods.${method}`) }

  if (method === 'HOME_DELIVERY') {
    const d = info as HomeDeliveryInfo
    return [
      methodField,
      { labelKey: 'order.recipient.fields.recipientName', value: d.recipientName },
      { labelKey: 'order.recipient.fields.recipientPhone', value: d.recipientPhone },
      { labelKey: 'order.recipient.fields.recipientAddress', value: d.recipientAddress }
    ]
  }
  if (method === 'STORE_PICKUP') {
    const d = info as StorePickupInfo
    return [
      methodField,
      { labelKey: 'order.recipient.fields.storeInfo', value: d.storeInfo },
      { labelKey: 'order.recipient.fields.recipientName', value: d.recipientName },
      { labelKey: 'order.recipient.fields.recipientPhone', value: d.recipientPhone }
    ]
  }
  const d = info as PickupInfo
  return [methodField, { labelKey: 'order.recipient.fields.location', value: d.location }]
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

// ---- 門市下拉選單（僅 PICKUP／門市自取 使用）----
// 注意命名陷阱（見 types/orderDelivery.ts 頂部註解）：PICKUP = 門市自取
// （自家門市取貨，對應這裡的下拉選單），STORE_PICKUP = 超商取貨（7-11／
// 全家等第三方通路，非本公司門市，不適用 /api/public/stores 這份自家
// 門市清單，storeInfo 維持純文字輸入，不要套用這個下拉選單邏輯）。
// 後端 /api/public/stores 只回傳 code/name，這裡下拉選單挑的是 name，
// 送到 PATCH .../delivery 的 deliveryInfo.location 一律是純文字店名，
// 不會送出 code（後端該欄位本來就只存純文字，見設計文件）。
// 此端點雖掛在 /api/public/ 前綴下，實際仍要求帶 JWT，因此跟其他訂單
// 相關呼叫一樣用 sessionHttp（會自動附上 Authorization），不是一般 axios。
interface StoreOption {
  code: string
  name: string
}
const storeOptions = ref<StoreOption[]>([])
const storeListState = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle')

async function loadStoreOptions() {
  if (storeListState.value === 'loading' || storeListState.value === 'loaded') return
  storeListState.value = 'loading'
  try {
    const response = await sessionHttp.get('/api/public/stores')
    if (response.data && response.data.success) {
      storeOptions.value = response.data.data ?? []
      storeListState.value = 'loaded'
    } else {
      storeListState.value = 'error'
    }
  } catch (err) {
    console.error('Failed to load store list:', err)
    storeListState.value = 'error'
  }
}

// 舊資料的 location 可能是先前手動輸入、不在門市清單裡的純文字，把它併進
// 選項讓 <select> 有東西可以顯示成「目前選中」，而不是使用者一打開編輯表單
// 就看到空白的下拉選單（即使底層的 location 其實有值）。
const storeSelectOptions = computed(() => {
  const names = storeOptions.value.map((s) => s.name)
  const current = pickupForm.location
  if (current && !names.includes(current)) {
    return [current, ...names]
  }
  return names
})

function clearFieldErrors() {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])
}

function startEditing() {
  formError.value = ''
  clearFieldErrors()
  // 進編輯模式就先抓門市清單，這樣使用者切到「超商取貨」分頁時清單通常已經
  // 載好；loadStoreOptions() 內部有 idle/loading/loaded 狀態擋重複呼叫。
  void loadStoreOptions()

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

// 盡力而為：呼叫端已經在呼叫這裡之前設定好自己要顯示的狀態（成功時準備退出
// 編輯模式；409/422 分支已設定好自己的 formError），重抓最新資料只是確保畫面
// 呈現的是伺服器真正落地的資料，而非直接信任回應 body。若這裡本身失敗（網路
// 異常、JWT 過期等），不應該讓例外往外傳導致呼叫端後續的收尾動作（例如
// ORDER_NOT_EDITABLE 分支的 `editing.value = false`）被跳過，因此在此吞掉例外
// 並僅記錄 log。
async function refetchDetail(): Promise<void> {
  try {
    const response = await sessionHttp.get(`/api/public/orders/sales/${props.orderId}`)
    if (response.data && response.data.success) {
      emit('updated', parseSalesOrderDeliveryDetail(response.data.data))
    }
  } catch (err) {
    console.error('Failed to refetch delivery detail:', err)
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
      // 不直接信任 PATCH 回應 body 拼出畫面要顯示的 detail——改成重新
      // GET 一次，確保畫面顯示的是伺服器實際落地後的資料（PATCH 回應與
      // 實際落地結果不一致時，直接信任回應 body 會讓畫面顯示錯誤的舊值，
      // 使用者得手動重新整理整個頁面才會看到正確內容）。
      await refetchDetail()
      editing.value = false
    } else {
      formError.value = t('order.recipient.errors.generic')
    }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const status = err.response.status
      const code = (err.response.data as { code?: string } | undefined)?.code

      if (status === 409 && code === 'VERSION_CONFLICT') {
        // 重抓最新資料覆蓋 props.detail（透過 emit('updated', ...)），並重新
        // 呼叫 startEditing() 讓表單改填最新值，避免使用者對照著舊的已輸入
        // 內容送出、用舊 version 覆蓋掉別人剛更新的結果（見設計文件「表單
        // 改填最新值」）。refetchDetail() 內的 emit('updated', ...) 是同步
        // 呼叫父層 `deliveryDetail = $event`，等這個 await 完成時
        // props.detail 已經是最新值，故此處可直接呼叫 startEditing() 讀取，
        // 不需要額外等待 nextTick。
        // 注意：startEditing() 一開始會把 formError 重設為空字串，所以提示
        // 文字要在呼叫它「之後」才設定，否則會被立刻清掉。
        await refetchDetail()
        startEditing()
        formError.value = t('order.recipient.errors.versionConflict')
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
        :key="field.labelKey || field.value"
        class="flex justify-between py-4 border-b border-outline-variant/20 last:border-b-0"
      >
        <span v-if="field.labelKey" class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t(field.labelKey) }}</span>
        <span
          class="font-data-mono text-sm text-on-surface text-right"
          :class="{ 'font-title-lg text-left': !field.labelKey }"
        >{{ field.value }}</span>
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
          <select
            v-if="storeListState !== 'error'"
            v-model="pickupForm.location"
            :disabled="storeListState === 'loading'"
            class="w-full border px-3 py-2 font-body-md text-sm text-on-surface bg-white focus:outline-none focus:border-primary disabled:opacity-50"
            :class="fieldErrors.location ? 'border-error' : 'border-outline-variant/30'"
          >
            <option value="" disabled>{{ storeListState === 'loading' ? $t('order.recipient.storeLoading') : $t('order.recipient.storePlaceholder') }}</option>
            <option v-for="name in storeSelectOptions" :key="name" :value="name">{{ name }}</option>
          </select>
          <template v-else>
            <input
              v-model="pickupForm.location"
              type="text"
              class="w-full border px-3 py-2 font-body-md text-sm text-on-surface focus:outline-none focus:border-primary"
              :class="fieldErrors.location ? 'border-error' : 'border-outline-variant/30'"
            />
            <p class="font-body-md text-xs text-primary mt-1">{{ $t('order.recipient.storeLoadError') }}</p>
          </template>
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
