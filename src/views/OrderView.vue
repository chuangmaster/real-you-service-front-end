<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import liff from '@line/liff'
import OrderStatusBadge from '../components/OrderStatusBadge.vue'
import OrderRecipientSection from '../components/OrderRecipientSection.vue'
import { sessionHttp, useCustomerSession } from '../composables/useCustomerSession'
import { parseSalesOrderDeliveryDetail, type SalesOrderDeliveryDetail } from '../types/orderDelivery'

interface OrderItem {
  inventoryItemId: string | null
  brand: string
  style: string
  imageUrl: string | null
  amount: number
}

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
    // Vue batches this ref update into the same microtask flush as the
    // initial mount, so without yielding to a real animation frame first,
    // the browser skips straight from nothing painted to the error state —
    // the loading spinner never actually renders on screen.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
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
      if (summary.value?.orderNumber) {
        document.title = `REAL YOU | 訂單 #${summary.value.orderNumber}`
      }
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

// LIFF 登入狀態與客戶授權憑證換發，皆改由共用的 useCustomerSession 處理
// （見 specs/001-liff-jwt-login/）。ensureSession() 內部已包含 liff.init()，
// 這裡不再自行呼叫，避免重複初始化。
const { sessionReady, isLiffLoggedIn, exchangeError, ensureSession, login, relogin } = useCustomerSession()
// exchangeError.code 屬於這三種時，代表「重新登入 LINE」可以解決問題，
// 對應顯示同一顆登入按鈕；NOT_BOUND（尚未綁定）與 kind: 'service'
// （服務類錯誤，code 為 undefined）不在此列，前者要靠綁定流程解決，
// 後者只能重試。見
// docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md。
const RELOGIN_CODES = ['INVALID_LINE_TOKEN', 'TOKEN_INVALIDATED', 'NOT_LOGGED_IN']
const sessionCanRelogin = computed(() => {
  // 用局部變數承接後再判斷，避免 exchangeError.value?.code !== undefined
  // 與後續 exchangeError.value.code 是兩個不同的存取表達式，TypeScript
  // 無法把後者的 exchangeError.value 窄化為非 null 而在型別檢查時報錯。
  const code = exchangeError.value?.code
  return code !== undefined && RELOGIN_CODES.includes(code)
})
const isInLiffClient = ref(false)

const closeLiffWindow = () => {
  liff.closeWindow()
}

// Binding state
const binding = ref(false)
const bindError = ref('')
// INVALID_LINE_TOKEN 時，「再點一次原本的綁定按鈕」無法解決問題（會用
// 同一顆過期 token 再送一次、再失敗一次），需要引導使用者重新登入 LINE，
// 見 docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md 死路 C。
const bindNeedsRelogin = ref(false)

// POST /api/public/orders/bind 失敗時的錯誤碼 → 文案對照，供 handleBind 使用。
const resolveBindErrorMessage = (code: string | undefined) => {
  switch (code) {
    case 'INVALID_LINE_TOKEN':
      return t('order.bind.errors.invalidLineToken')
    case 'LINE_ALREADY_BOUND':
      return t('order.bind.errors.lineAlreadyBound')
    case 'CUSTOMER_ALREADY_BOUND':
      return t('order.bind.errors.customerAlreadyBound')
    default:
      return t('order.errorServer')
  }
}

// Recipient/delivery detail state — only fetched for bound Sales orders once
// the customer has a valid session JWT. Silent-failure by design: the
// section just doesn't appear on failure.
// See docs/superpowers/specs/2026-08-06-order-recipient-delivery-design.md.
const deliveryDetail = ref<SalesOrderDeliveryDetail | null>(null)

const maybeFetchDeliveryDetail = async () => {
  if (!summary.value) return
  if (summary.value.orderKind !== 'Sales') return
  if (!summary.value.isBound || !sessionReady.value) return

  try {
    const response = await sessionHttp.get(`/api/public/orders/sales/${summary.value.orderId}`)
    if (response.data && response.data.success) {
      deliveryDetail.value = parseSalesOrderDeliveryDetail(response.data.data)
    }
  } catch (err) {
    console.error('Failed to load delivery detail:', err)
  }
}

const handleBind = async () => {
  if (binding.value || !summary.value) return

  bindError.value = ''
  bindNeedsRelogin.value = false

  if (exchangeError.value?.kind === 'service') {
    bindError.value = t('order.bind.errorLiffUnavailable')
    return
  }

  binding.value = true
  try {
    if (!isLiffLoggedIn.value) {
      // 導向整頁的 LINE 登入，登入完成後導回同一個 URL（含 `t` query param）；
      // 執行不會繼續往下走。
      login()
      return
    }

    const lineIdToken = liff.getIDToken()
    const response = await axios.post('/api/public/orders/bind', {
      t: token.value,
      lineIdToken
    })

    if (response.data && response.data.success) {
      summary.value.isBound = true
      // 綁定前的 ensureSession() 很可能因客戶當時尚未綁定而以 NOT_BOUND
      // 失敗、sessionReady 停留在 false；綁定成功後客戶已可換發憑證，
      // 需重新呼叫一次才能讓 maybeFetchDeliveryDetail() 真正抓到資料。
      ensureSession()
        .then(() => maybeFetchDeliveryDetail())
        .catch((err) => console.error('Failed to refresh session after bind:', err))
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
      } else {
        bindError.value = resolveBindErrorMessage(code)
        bindNeedsRelogin.value = code === 'INVALID_LINE_TOKEN'
      }
    } else {
      bindError.value = resolveBindErrorMessage(undefined)
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

onMounted(async () => {
  await Promise.all([fetchOrderSummary(), ensureSession()])
  try {
    isInLiffClient.value = liff.isInClient()
  } catch {
    isInLiffClient.value = false
  }
  maybeFetchDeliveryDetail()
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
          <div class="flex items-center justify-between py-4 border-b border-outline-variant/20">
            <span class="font-label-caps text-xs text-secondary uppercase tracking-wider">{{ $t('order.summary.status') }}</span>
            <OrderStatusBadge :status="summary.status" />
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
          <template v-for="(orderItem, index) in summary.items" :key="index">
            <!-- inventoryItemId 可能是 null（後端 PublicOrderItemResult 該欄位為 nullable
                 uuid，例如服務單品項本來就沒有對應的 inventory 紀錄）——只有拿得到 id
                 才把整列做成連到鑑定頁面（/product/:id，即 ProductDetailView）的連結，
                 否則維持原本純文字顯示，避免連到一個註定 404 的頁面。整列可點擊
                 （而非只有商品名稱文字）搭配右側 chevron 圖示，比純文字加底線更明確
                 地提示「這裡可以點」，熱區也更大、更適合手機瀏覽器操作。 -->
            <router-link
              v-if="orderItem.inventoryItemId"
              :to="{ name: 'product-detail', params: { id: orderItem.inventoryItemId } }"
              class="flex items-center gap-4 bg-surface-container-low p-4 hover:bg-surface-container active:bg-surface-container transition-colors"
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
              <span class="material-symbols-outlined text-secondary text-[20px] flex-shrink-0">chevron_right</span>
            </router-link>
            <div v-else class="flex items-center gap-4 bg-surface-container-low p-4">
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
          </template>
        </div>
      </div>

      <OrderRecipientSection
        v-if="deliveryDetail"
        :detail="deliveryDetail"
        :order-id="summary.orderId"
        @updated="deliveryDetail = $event"
      />

      <!-- BIND SECTION -->
      <div v-if="!summary.isBound" class="bg-white border border-outline-variant/30 shadow-sm p-6 text-center">
        <!-- 已經顯示錯誤時，「同意綁定」提示文字沒有意義（甚至矛盾），改顯示錯誤訊息即可 -->
        <p v-if="!bindError" class="font-body-md text-sm text-secondary mb-5">{{ $t('order.bind.prompt') }}</p>
        <p v-else class="font-body-md text-xs text-primary mb-4">{{ bindError }}</p>
        <button
          class="w-full bg-primary text-white px-8 py-4 font-label-caps text-label-caps hover:bg-primary-container transition-colors duration-300 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="binding"
          @click="bindNeedsRelogin ? relogin() : handleBind()"
        >
          {{ binding ? $t('order.bind.submitting') : bindNeedsRelogin ? $t('order.session.loginButton') : $t('order.bind.button') }}
        </button>
      </div>

      <!-- CUSTOMER SESSION EXCHANGE ERROR（客戶授權憑證換發失敗，FR-006）
           擇一顯示：綁定區塊優先，避免使用者尚未綁定時同時看到「請先綁定」
           與這裡的換發失敗訊息（兩者語意重疊或互相矛盾）。綁定完成、或自動
           靜默綁定不在進行中之後，才輪到這裡呈現換發失敗的狀態。
           deliveryDetail 存在時（收件資訊表單已顯示）額外抑制這個區塊——
           表單儲存 401 時會在表單內自己顯示重新登入提示（見
           OrderRecipientSection.vue），這裡若同時顯示會出現兩顆重複的
           「重新登入 LINE」按鈕，見
           docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md
           第二節「重複入口的處理」。 -->
      <div v-else-if="exchangeError && !deliveryDetail" class="bg-white border border-outline-variant/30 shadow-sm p-6 text-center mt-4">
        <p class="font-body-md text-sm text-primary mb-4">
          {{
            exchangeError.code === 'NOT_BOUND'
              ? $t('order.session.bindRequired')
              : exchangeError.code === 'NOT_LOGGED_IN'
                ? $t('order.session.loginRequired')
                : exchangeError.kind === 'identity'
                  ? $t('order.session.errorIdentity')
                  : $t('order.session.errorService')
          }}
        </p>
        <button
          v-if="sessionCanRelogin"
          class="w-full bg-primary text-white px-8 py-4 font-label-caps text-label-caps hover:bg-primary-container transition-colors duration-300 tracking-widest"
          @click="relogin"
        >
          {{ $t('order.session.loginButton') }}
        </button>
        <button
          v-else-if="exchangeError.kind === 'service'"
          class="w-full bg-primary text-white px-8 py-4 font-label-caps text-label-caps hover:bg-primary-container transition-colors duration-300 tracking-widest"
          @click="ensureSession"
        >
          {{ $t('order.session.retry') }}
        </button>
      </div>
    </div>
  </div>
</template>
