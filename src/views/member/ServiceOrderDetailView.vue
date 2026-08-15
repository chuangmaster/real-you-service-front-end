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
