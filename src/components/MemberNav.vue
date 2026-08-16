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
      <router-link to="/" class="brand-logo-nav">REAL YOU</router-link>
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
