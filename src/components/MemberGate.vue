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
