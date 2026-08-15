<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
//
// 注意：member-orders-service 與 member-orders-sales 這兩個路由在同一個
// RouterView 深度都渲染這個元件，Vue Router 不會在兩者間切換時重新掛載
// 元件實例（沒有 :key），所以這個元件實例是「服務單」「訂單」兩個分頁
// 共用的——fetchOrders 只在第一次掛載時跑一次，之後切換分頁靠的是
// orderKind 改變去重新篩選/重設分頁游標，而不是重新掛載觸發新的抓取。
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

// 切換分頁（orderKind 改變）時重設「載入更多」游標，避免某一分頁展開過的
// visibleCount 殘留到另一個分頁（元件實例是共用的，見上方註解）。
watch(orderKind, () => {
  visibleCount.value = BATCH_SIZE
})

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
      <p class="font-body-md text-secondary mb-8">{{ error }}</p>
      <button
        type="button"
        class="bg-primary text-white px-8 py-3 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300"
        @click="fetchOrders"
      >
        {{ $t('member.orders.retry') }}
      </button>
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
