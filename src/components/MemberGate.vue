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

// 自動導轉的 loop breaker：同一分頁內只允許自動觸發一次 login()。
// 若導回後仍然是 NOT_LOGGED_IN（第三方 cookie 被擋、LIFF endpoint URL
// 設定錯誤、使用者在 LINE 登入畫面取消……），代表自動導轉救不了，
// 改為顯示錯誤卡片讓使用者手動點擊登入，避免無限重新導向迴圈。
const LOGIN_ATTEMPTED_KEY = 'realyou.memberGateLoginAttempted'

watch(exchangeError, (err) => {
  if (!err) return
  if (err.code === 'NOT_LOGGED_IN') {
    if (!sessionStorage.getItem(LOGIN_ATTEMPTED_KEY)) {
      sessionStorage.setItem(LOGIN_ATTEMPTED_KEY, '1')
      login()
    }
    // 已經自動導轉過一次仍回到 NOT_LOGGED_IN：不再自動呼叫 login()，
    // 落到樣板的錯誤分支顯示手動登入按鈕。
  } else if (err.code && RELOGIN_CODES.includes(err.code)) {
    relogin()
  }
})

// 換發成功後清除 marker，避免之後真的重新進頁時被舊的失敗記錄誤判。
watch(sessionReady, (ready) => {
  if (ready) {
    sessionStorage.removeItem(LOGIN_ATTEMPTED_KEY)
  }
})

// 會觸發自動導轉、因此樣板顯示「載入中」而非錯誤卡片的 code：
// - NOT_LOGGED_IN 且尚未自動導轉過一次
// - INVALID_LINE_TOKEN / TOKEN_INVALIDATED（一律自動 relogin）
// 其餘任何 exchangeError（包含 NOT_BOUND、service 類錯誤，以及任何
// watcher 不認得的未來後端 code）都視為自動導轉救不了，顯示錯誤卡片，
// 避免落到 loading 分支變成永久轉圈圈。
function isAutoRedirecting(): boolean {
  if (!exchangeError.value) return false
  const code = exchangeError.value.code
  if (code === 'NOT_LOGGED_IN') {
    return !sessionStorage.getItem(LOGIN_ATTEMPTED_KEY)
  }
  return !!code && RELOGIN_CODES.includes(code)
}

function retry() {
  ensureSession()
}

// 手動登入迴圈中斷後的按鈕：使用者主動點擊，允許直接導轉一次。
function manualLogin() {
  login()
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
    v-else-if="exchangeError && !isAutoRedirecting()"
    class="min-h-screen flex flex-col items-center justify-center text-center px-margin-mobile"
  >
    <span class="material-symbols-outlined text-primary text-[48px] mb-6">gpp_maybe</span>
    <p class="font-body-md text-secondary mb-8">
      {{ exchangeError.code === 'NOT_BOUND' ? t('member.gate.notBound') : t('member.gate.serviceUnavailable') }}
    </p>
    <button
      v-if="exchangeError.code === 'NOT_LOGGED_IN'"
      class="bg-primary text-white px-8 py-3 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300"
      @click="manualLogin"
    >
      {{ t('order.session.loginButton') }}
    </button>
    <button
      v-else
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
