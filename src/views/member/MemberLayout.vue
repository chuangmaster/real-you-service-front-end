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
