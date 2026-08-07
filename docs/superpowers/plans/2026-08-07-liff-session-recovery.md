# LINE 身分失效復原路徑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 `OrderView.vue` 在 LINE 身分失效的四種情境（Token 過期、憑證被作廢、綁定流程中 Token 過期、完全未登入）下都提供使用者可自行執行的「重新登入 LINE」出路，不再出現按鈕全部失效的死路。

**Architecture:** 在 `useCustomerSession` composable 新增單一 `relogin()` 函式（清除本地憑證 → 視情況 `liff.logout()` → `liff.login()`），作為三個消費端（`OrderView.vue` 的 exchangeError 區塊、綁定按鈕、`OrderRecipientSection.vue` 的儲存錯誤處理）共用的復原入口。並修正 `ensureSession()` 在使用者完全未登入 LINE 時不設定任何錯誤狀態的既有缺陷。

**Tech Stack:** Vue 3 `<script setup lang="ts">`、`@line/liff`、`axios`、`vue-i18n`。

## Global Constraints

- 本專案沒有測試框架、沒有 lint script（見 `CLAUDE.md`）。本計畫以 `npm run type-check`（`vue-tsc --noEmit`）作為每個任務的自動化檢查，並用 `npm run dev` 搭配瀏覽器手動驗證取代自動化測試——這是對 writing-plans 標準 TDD 步驟的刻意調整，不是遺漏。
- 新增/修改的程式碼註解一律使用繁體中文，identifier（變數、函式、i18n key）使用英文，不得中英混用（`CLAUDE.md` Language 段落）。
- 任何新增的 i18n key 必須同時新增 `en` 與 `zh-TW` 兩份，唯一存放位置是 `src/i18n.ts`（`CLAUDE.md` i18n 段落）。
- `relogin()` 必須先 `clearStoredSession()`、確認登入狀態後才 `liff.logout()`、最後才 `liff.login()`——順序錯誤會製造新的無限跳轉死路（見 spec 決策段落）。
- 不做表單草稿暫存、不做自動重新登入、不做迴圈計數器、不修改 nginx/vite proxy 設定（見 spec「不在本次範圍」）。
- 對應設計文件：`docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md`。

---

## Task 1: `useCustomerSession` 新增 `relogin()`，修正未登入時的靜默缺陷

**Files:**
- Modify: `src/composables/useCustomerSession.ts:28-40`（`ExchangeError.code` 的 JSDoc）
- Modify: `src/composables/useCustomerSession.ts:194-197`（`ensureSession()` 未登入分支）
- Modify: `src/composables/useCustomerSession.ts:217-229`（`login()` 之後新增 `relogin()`，並更新 `useCustomerSession()` 回傳值）

**Interfaces:**
- Consumes: 無新依賴，沿用既有的 `liff`、`clearStoredSession()`、`sessionReady`、`exchangeError`、`ensureLiffInit()`。
- Produces:
  - `relogin(): Promise<void>` — 從 `useCustomerSession()` 回傳，供 Task 3/4/5 呼叫。
  - `ExchangeError.code` 新增可能值 `'NOT_LOGGED_IN'`（`ensureSession()` 在使用者未登入 LINE 時設定）。

- [ ] **Step 1: 更新 `ExchangeError.code` 的 JSDoc，補上 `NOT_LOGGED_IN`**

在 `src/composables/useCustomerSession.ts:28-40` 現有的 `ExchangeError` interface 定義中，於 `TOKEN_INVALIDATED` 說明後補上一行：

```ts
export interface ExchangeError {
  /** 依 research.md §5 的規則分類：身分類或服務類 */
  kind: 'identity' | 'service'
  /**
   * 身分類錯誤時，後端回傳的 ResponseCodes：
   * - `INVALID_LINE_TOKEN`（401）：LINE ID Token 驗證失敗
   * - `NOT_BOUND`（403）：該 LINE 帳號尚未完成綁定
   * - `TOKEN_INVALIDATED`：非後端回傳碼，前端自訂——受保護端點回應 401
   *   時代表 security stamp 比對失敗（例如密碼被異動），憑證雖未過期但
   *   已被後端主動作廢
   * - `NOT_LOGGED_IN`：非後端回傳碼，前端自訂——ensureSession() 偵測到
   *   使用者尚未登入 LINE 時設定，讓頁面知道要顯示「請重新登入」的入口
   *   （見 docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md）
   */
  code?: string
}
```

- [ ] **Step 2: 修正 `ensureSession()` 未登入時不設定錯誤的缺陷**

將 `src/composables/useCustomerSession.ts:194-197` 現有的：

```ts
    // 尚未登入 LINE：不強制導頁，僅回報狀態給頁面決定 UI（FR-002）
    if (!isLiffLoggedIn.value) {
      return null
    }
```

改為：

```ts
    // 尚未登入 LINE：不強制導頁，僅回報狀態給頁面決定 UI（FR-002）。
    // 設定 exchangeError 讓頁面知道「尚未登入」並提供登入入口，而非像
    // 先前一樣靜默 return null 導致畫面完全沒有任何提示或按鈕（見
    // docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md
    // 死路 D）。
    if (!isLiffLoggedIn.value) {
      exchangeError.value = { kind: 'identity', code: 'NOT_LOGGED_IN' }
      return null
    }
```

- [ ] **Step 3: 新增 `relogin()` 並匯出**

在 `src/composables/useCustomerSession.ts:217`（`login()` 函式定義之後、`export function useCustomerSession()` 之前）新增：

```ts
// 供頁面在偵測到 LINE 身分失效（INVALID_LINE_TOKEN / TOKEN_INVALIDATED /
// NOT_LOGGED_IN）時呼叫，統一的「重新登入」出路，供 OrderView.vue 的
// exchangeError 區塊、綁定按鈕、OrderRecipientSection.vue 共用。見
// docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md。
//
// 依序處理三件事：
// 1. 先清除本地憑證——TOKEN_INVALIDATED 的情況下，若不清除，登入完成後
//    ensureSession() 會經由 readStoredSession() 沿用同一顆已被後端作廢的
//    舊憑證（該函式只檢查 expiresAt，無從得知後端已作廢），使用者重新
//    登入了卻毫無改變。
// 2. 若目前仍是登入狀態就先登出——INVALID_LINE_TOKEN 的情況下，LIFF
//    session 可能仍在、只是 ID Token 過期，此時直接呼叫 login() 有機會被
//    SDK 判定為已登入而立即導回，取得同一顆過期 token，變成第二個死路。
// 3. 最後才呼叫 login()，帶回目前網址（含 ?t= query）。此呼叫會使整頁
//    跳轉，函式本身不會回到呼叫端。
async function relogin(): Promise<void> {
  clearStoredSession()
  sessionReady.value = false
  const initOk = await ensureLiffInit()
  if (!initOk) {
    exchangeError.value = { kind: 'service' }
    return
  }
  if (liff.isLoggedIn()) {
    liff.logout()
  }
  liff.login({ redirectUri: window.location.href })
}
```

並將 `export function useCustomerSession()` 的回傳物件（`src/composables/useCustomerSession.ts:221-229`）改為：

```ts
export function useCustomerSession() {
  return {
    sessionReady,
    isLiffLoggedIn,
    exchangeError,
    ensureSession,
    login,
    relogin
  }
}
```

- [ ] **Step 4: 執行型別檢查**

Run: `npm run type-check`
Expected: 無新增錯誤（沿用既有的既有錯誤數，若原本是 0 則維持 0）。

- [ ] **Step 5: 確認說明**

此任務新增的 `relogin()` 目前沒有任何呼叫端，無法單獨在瀏覽器手動驗證。它的行為會在 Task 3（情境 D：完全未登入）與 Task 5（情境 B：憑證被作廢，驗證 `clearStoredSession()` 是否確實生效）的手動驗證步驟中一併確認，屆時才具備完整的可觀察行為。

- [ ] **Step 6: Commit**

```bash
git add src/composables/useCustomerSession.ts
git commit -m "feat: add relogin() to useCustomerSession, fix silent NOT_LOGGED_IN gap

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: 新增 i18n key（`loginRequired`、`loginButton`、`sessionExpired`）

**Files:**
- Modify: `src/i18n.ts:95-100`（`en.order.session`）
- Modify: `src/i18n.ts:122-127`（`en.order.recipient.errors`）
- Modify: `src/i18n.ts:225-230`（`zh-TW.order.session`）
- Modify: `src/i18n.ts:252-257`（`zh-TW.order.recipient.errors`）

**Interfaces:**
- Consumes: 無。
- Produces: 三組 i18n key，供 Task 3/4/5 的模板使用：
  - `order.session.loginRequired`
  - `order.session.loginButton`
  - `order.recipient.errors.sessionExpired`

- [ ] **Step 1: 新增英文 `order.session` 的兩個 key**

將 `src/i18n.ts:95-100` 現有的：

```ts
      session: {
        errorIdentity: 'LINE identity verification failed. Please log in to LINE again.',
        errorService: 'Service is temporarily unavailable. Please try again later.',
        retry: 'RETRY',
        bindRequired: 'This LINE account has not been bound yet. Please complete binding via your order link first.'
      },
```

改為：

```ts
      session: {
        errorIdentity: 'LINE identity verification failed. Please log in to LINE again.',
        errorService: 'Service is temporarily unavailable. Please try again later.',
        retry: 'RETRY',
        bindRequired: 'This LINE account has not been bound yet. Please complete binding via your order link first.',
        loginRequired: 'Please log in to LINE to continue.',
        loginButton: 'LOG IN TO LINE'
      },
```

- [ ] **Step 2: 新增英文 `order.recipient.errors.sessionExpired`**

將 `src/i18n.ts:122-127` 現有的：

```ts
        errors: {
          versionConflict: 'This information was just updated. Please review the latest details and submit again.',
          notEditable: 'This order can no longer have its recipient information changed.',
          invalidInfo: 'Please make sure all recipient information is filled in.',
          generic: 'Something went wrong. Please try again later.'
        },
```

改為：

```ts
        errors: {
          versionConflict: 'This information was just updated. Please review the latest details and submit again.',
          notEditable: 'This order can no longer have its recipient information changed.',
          invalidInfo: 'Please make sure all recipient information is filled in.',
          generic: 'Something went wrong. Please try again later.',
          sessionExpired: 'Your LINE session has expired. Please log in again to save your changes.'
        },
```

- [ ] **Step 3: 新增繁中 `order.session` 的兩個 key**

將 `src/i18n.ts:225-230` 現有的：

```ts
      session: {
        errorIdentity: 'LINE 身分驗證失敗，請重新登入 LINE。',
        errorService: '服務暫時無法使用，請稍後再試。',
        retry: '重試',
        bindRequired: '此 LINE 帳號尚未完成綁定，請先透過訂單連結完成綁定。'
      },
```

改為：

```ts
      session: {
        errorIdentity: 'LINE 身分驗證失敗，請重新登入 LINE。',
        errorService: '服務暫時無法使用，請稍後再試。',
        retry: '重試',
        bindRequired: '此 LINE 帳號尚未完成綁定，請先透過訂單連結完成綁定。',
        loginRequired: '請先登入 LINE 才能繼續。',
        loginButton: '重新登入 LINE'
      },
```

- [ ] **Step 4: 新增繁中 `order.recipient.errors.sessionExpired`**

將 `src/i18n.ts:252-257` 現有的：

```ts
        errors: {
          versionConflict: '資料已被更新，請重新確認後再提交。',
          notEditable: '此訂單目前狀態已無法修改收件資訊。',
          invalidInfo: '請確認收件資訊填寫完整。',
          generic: '發生錯誤，請稍候再試。'
        },
```

改為：

```ts
        errors: {
          versionConflict: '資料已被更新，請重新確認後再提交。',
          notEditable: '此訂單目前狀態已無法修改收件資訊。',
          invalidInfo: '請確認收件資訊填寫完整。',
          generic: '發生錯誤，請稍候再試。',
          sessionExpired: '您的 LINE 登入已過期，請重新登入後再儲存變更。'
        },
```

- [ ] **Step 5: 執行型別檢查**

Run: `npm run type-check`
Expected: 無新增錯誤。

- [ ] **Step 6: 確認兩個語系的 key 數量一致**

Run:
```bash
grep -c "loginRequired:\|loginButton:" src/i18n.ts
grep -c "sessionExpired:" src/i18n.ts
```
Expected: 兩個指令都輸出 `2`（分別代表 en、zh-TW 各一份）。

- [ ] **Step 7: Commit**

```bash
git add src/i18n.ts
git commit -m "feat: add i18n keys for LINE relogin prompts

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: `OrderView.vue` — exchangeError 區塊改為三選一按鈕，並在收件表單顯示時抑制

**Files:**
- Modify: `src/views/OrderView.vue:90`（composable 解構，加入 `relogin`）
- Modify: `src/views/OrderView.vue:90` 之後新增 `sessionCanRelogin` computed
- Modify: `src/views/OrderView.vue:394-411`（exchangeError 模板區塊）

**Interfaces:**
- Consumes: Task 1 的 `relogin(): Promise<void>`；Task 2 的 `order.session.loginRequired`、`order.session.loginButton`。
- Produces: computed `sessionCanRelogin: ComputedRef<boolean>`（供本任務模板內部使用，不對外匯出）。

- [ ] **Step 1: 解構出 `relogin`**

將 `src/views/OrderView.vue:90` 現有的：

```ts
const { sessionReady, isLiffLoggedIn, exchangeError, ensureSession, login } = useCustomerSession()
```

改為：

```ts
const { sessionReady, isLiffLoggedIn, exchangeError, ensureSession, login, relogin } = useCustomerSession()
```

- [ ] **Step 2: 新增 `sessionCanRelogin` computed**

緊接在上一行之後新增：

```ts
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
```

- [ ] **Step 3: 更新 exchangeError 模板區塊**

將 `src/views/OrderView.vue:394-411` 現有的：

```html
      <!-- CUSTOMER SESSION EXCHANGE ERROR（客戶授權憑證換發失敗，FR-006）
           擇一顯示：綁定區塊優先，避免使用者尚未綁定時同時看到「請先綁定」
           與這裡的換發失敗訊息（兩者語意重疊或互相矛盾）。綁定完成、或自動
           靜默綁定不在進行中之後，才輪到這裡呈現換發失敗的狀態。 -->
      <div v-else-if="exchangeError" class="bg-white border border-outline-variant/30 shadow-sm p-6 text-center mt-4">
        <p class="font-body-md text-sm text-primary mb-4">
          {{
            exchangeError.code === 'NOT_BOUND'
              ? $t('order.session.bindRequired')
              : exchangeError.kind === 'identity'
                ? $t('order.session.errorIdentity')
                : $t('order.session.errorService')
          }}
        </p>
        <button
          v-if="exchangeError.kind === 'service'"
          class="w-full bg-primary text-white px-8 py-4 font-label-caps text-label-caps hover:bg-primary-container transition-colors duration-300 tracking-widest"
          @click="ensureSession"
        >
          {{ $t('order.session.retry') }}
        </button>
      </div>
```

改為：

```html
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
```

- [ ] **Step 4: 執行型別檢查**

Run: `npm run type-check`
Expected: 無新增錯誤。

- [ ] **Step 5: 手動驗證情境 D（完全未登入 LINE）**

對應 spec 驗證清單第 2 項。

1. Run: `npm run dev`
2. 準備一筆**已綁定**（`isBound: true`）的訂單分享連結（需有對應後端測試資料；若本機後端未啟動，改為在瀏覽器 DevTools 用 `axios` mock 或直接檢視 Network 分頁確認 `GET /api/public/orders/view` 回應）。
3. 用未登入 LINE 狀態、外部瀏覽器（非 LIFF client）開啟該連結。
4. Expected：畫面下半部不再是空白，而是顯示「請先登入 LINE 才能繼續。」與「重新登入 LINE」按鈕。
5. 點擊按鈕，確認觸發 `liff.login()`（會嘗試導頁；若本機無有效 `VITE_LIFF_ID`，確認 DevTools Console 沒有拋出未預期的例外，且行為在合理範圍內，例如導向 LINE 登入頁或顯示 LIFF 設定錯誤）。

- [ ] **Step 6: Commit**

```bash
git add src/views/OrderView.vue
git commit -m "fix: give identity-class session errors a working relogin path

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `OrderView.vue` — 綁定按鈕在 Token 過期時改為「重新登入」

**Files:**
- Modify: `src/views/OrderView.vue:98-100`（新增 `bindNeedsRelogin` ref）
- Modify: `src/views/OrderView.vue:144-199`（`handleBind`）
- Modify: `src/views/OrderView.vue:205-246`（`attemptAutoBind`）
- Modify: `src/views/OrderView.vue:381-387`（綁定按鈕模板）

**Interfaces:**
- Consumes: Task 1 的 `relogin()`；Task 2 的 `order.session.loginButton`；既有的 `resolveBindErrorMessage()`、`PERMANENT_BIND_CONFLICT_CODES`。
- Produces: `bindNeedsRelogin: Ref<boolean>`（本任務模板使用，不對外匯出）。

- [ ] **Step 1: 新增 `bindNeedsRelogin` ref**

將 `src/views/OrderView.vue:98-100` 現有的：

```ts
// Binding state
const binding = ref(false)
const bindError = ref('')
const autoBindInProgress = ref(false)
```

改為：

```ts
// Binding state
const binding = ref(false)
const bindError = ref('')
const autoBindInProgress = ref(false)
// INVALID_LINE_TOKEN 時，「再點一次原本的綁定按鈕」無法解決問題（會用
// 同一顆過期 token 再送一次、再失敗一次），需要引導使用者重新登入 LINE，
// 見 docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md 死路 C。
const bindNeedsRelogin = ref(false)
```

- [ ] **Step 2: `handleBind` 開頭重置 `bindNeedsRelogin`**

將 `src/views/OrderView.vue:144-147` 現有的：

```ts
const handleBind = async () => {
  if (binding.value || !summary.value) return

  bindError.value = ''
```

改為：

```ts
const handleBind = async () => {
  if (binding.value || !summary.value) return

  bindError.value = ''
  bindNeedsRelogin.value = false
```

- [ ] **Step 3: `handleBind` 的錯誤分支設定 `bindNeedsRelogin`**

將 `src/views/OrderView.vue:180-195` 現有的：

```ts
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
      }
    } else {
      bindError.value = resolveBindErrorMessage(undefined)
    }
  } finally {
    binding.value = false
  }
```

改為：

```ts
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
```

- [ ] **Step 4: `attemptAutoBind` 不再對 `INVALID_LINE_TOKEN` 靜默**

將 `src/views/OrderView.vue:225-242` 現有的：

```ts
  } catch (err) {
    if (axios.isAxiosError(err) && err.response && err.response.status === 404) {
      // Same "invalid link" state as the initial GET /view 404 — the
      // share token itself is no longer valid.
      summary.value = null
      error.value = t('order.errorInvalidLink')
    } else {
      const code = axios.isAxiosError(err) ? err.response?.data?.code : undefined
      if (code && PERMANENT_BIND_CONFLICT_CODES.includes(code)) {
        // 重試（無論是靜默重試還是使用者再點一次按鈕）都無法解決的永久性衝突，
        // 不再照原設計靜默吞掉，直接顯示錯誤讓使用者知道要聯絡客服。
        bindError.value = resolveBindErrorMessage(code)
      } else {
        // 其餘暫時性錯誤（LINE token 問題、網路/伺服器錯誤等）維持原本靜默設計：
        // 只記錄 console.error，退回顯示手動綁定按鈕讓使用者可以重試。
        console.error('Silent auto-bind failed:', err)
      }
    }
  } finally {
    autoBindInProgress.value = false
  }
```

改為：

```ts
  } catch (err) {
    if (axios.isAxiosError(err) && err.response && err.response.status === 404) {
      // Same "invalid link" state as the initial GET /view 404 — the
      // share token itself is no longer valid.
      summary.value = null
      error.value = t('order.errorInvalidLink')
    } else {
      const code = axios.isAxiosError(err) ? err.response?.data?.code : undefined
      if (code === 'INVALID_LINE_TOKEN') {
        // 靜默重試無法解決 ID Token 已過期的問題（會一直用同一顆過期
        // token 再試），需要使用者重新登入，因此比照
        // PERMANENT_BIND_CONFLICT_CODES 改為顯示錯誤而非吞掉，並將手動
        // 綁定按鈕切換成重新登入按鈕。見
        // docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md
        // 死路 C。
        bindError.value = resolveBindErrorMessage(code)
        bindNeedsRelogin.value = true
      } else if (code && PERMANENT_BIND_CONFLICT_CODES.includes(code)) {
        // 重試（無論是靜默重試還是使用者再點一次按鈕）都無法解決的永久性衝突，
        // 不再照原設計靜默吞掉，直接顯示錯誤讓使用者知道要聯絡客服。
        bindError.value = resolveBindErrorMessage(code)
      } else {
        // 其餘暫時性錯誤（網路/伺服器錯誤等）維持原本靜默設計：
        // 只記錄 console.error，退回顯示手動綁定按鈕讓使用者可以重試。
        console.error('Silent auto-bind failed:', err)
      }
    }
  } finally {
    autoBindInProgress.value = false
  }
```

- [ ] **Step 5: 綁定按鈕模板改為依 `bindNeedsRelogin` 切換行為**

將 `src/views/OrderView.vue:381-387` 現有的：

```html
        <button
          class="w-full bg-primary text-white px-8 py-4 font-label-caps text-label-caps hover:bg-primary-container transition-colors duration-300 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="binding"
          @click="handleBind"
        >
          {{ binding ? $t('order.bind.submitting') : $t('order.bind.button') }}
        </button>
```

改為：

```html
        <button
          class="w-full bg-primary text-white px-8 py-4 font-label-caps text-label-caps hover:bg-primary-container transition-colors duration-300 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="binding"
          @click="bindNeedsRelogin ? relogin() : handleBind()"
        >
          {{ binding ? $t('order.bind.submitting') : bindNeedsRelogin ? $t('order.session.loginButton') : $t('order.bind.button') }}
        </button>
```

- [ ] **Step 6: 執行型別檢查**

Run: `npm run type-check`
Expected: 無新增錯誤。

- [ ] **Step 7: 手動驗證（範圍內可行的部分）**

對應 spec 驗證清單第 4 項：情境 C（`INVALID_LINE_TOKEN`）需要「LIFF session 仍在但 ID Token 已過期」的真實狀態，無法在前端單獨重現，需後端配合暫時回傳 401 + `INVALID_LINE_TOKEN`。若本次沒有後端配合窗口，執行以下程式碼審查取代實機驗證：

1. 確認 `handleBind` 與 `attemptAutoBind` 的 catch 分支都會在 `code === 'INVALID_LINE_TOKEN'` 時設定 `bindNeedsRelogin.value = true`（對照 Step 3、Step 4 的程式碼）。
2. 確認按鈕模板的三元運算式在 `bindNeedsRelogin` 為 `true` 且非 `binding` 中時，文字與 `@click` 都會切換成 `relogin` 路徑（對照 Step 5）。
3. 執行 `npm run dev`，在收件表單以外任意頁面手動於瀏覽器 Console 執行 `document.querySelector('button')` 確認頁面正常渲染（僅作為排除語法錯誤的最低限度檢查，不能取代真正的後端配合測試）。

- [ ] **Step 8: Commit**

```bash
git add src/views/OrderView.vue
git commit -m "fix: switch bind button to relogin path on INVALID_LINE_TOKEN

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: `OrderRecipientSection.vue` — 儲存遇 401 顯示重新登入提示

**Files:**
- Modify: `src/components/OrderRecipientSection.vue:5`（import 加入 `useCustomerSession`）
- Modify: `src/components/OrderRecipientSection.vue:25`（解構 `relogin`）
- Modify: `src/components/OrderRecipientSection.vue:73-77`（新增 `needsRelogin` ref）
- Modify: `src/components/OrderRecipientSection.vue:172-189`（`startEditing` 重置 `needsRelogin`）
- Modify: `src/components/OrderRecipientSection.vue:186-189`（`cancelEditing` 重置 `needsRelogin`）
- Modify: `src/components/OrderRecipientSection.vue:280-286`（`handleSave` 開頭重置）
- Modify: `src/components/OrderRecipientSection.vue:308-338`（`handleSave` 的 catch 分支新增 401 處理）
- Modify: `src/components/OrderRecipientSection.vue:478`（模板新增重新登入按鈕）

**Interfaces:**
- Consumes: Task 1 的 `relogin()`；Task 2 的 `order.recipient.errors.sessionExpired`、`order.session.loginButton`。
- Produces: `needsRelogin: Ref<boolean>`（本元件內部使用，不對外 emit）。

- [ ] **Step 1: import 加入 `useCustomerSession`**

將 `src/components/OrderRecipientSection.vue:5` 現有的：

```ts
import { sessionHttp } from '../composables/useCustomerSession'
```

改為：

```ts
import { sessionHttp, useCustomerSession } from '../composables/useCustomerSession'
```

- [ ] **Step 2: 解構出 `relogin`**

將 `src/components/OrderRecipientSection.vue:25` 現有的：

```ts
const { t } = useI18n()
```

改為：

```ts
const { t } = useI18n()
const { relogin } = useCustomerSession()
```

- [ ] **Step 3: 新增 `needsRelogin` ref**

將 `src/components/OrderRecipientSection.vue:73-77` 現有的：

```ts
const editing = ref(false)
const saving = ref(false)
const formError = ref('')
const formMethod = ref<DeliveryMethod>('HOME_DELIVERY')
const fieldErrors = reactive<Record<string, boolean>>({})
```

改為：

```ts
const editing = ref(false)
const saving = ref(false)
const formError = ref('')
const formMethod = ref<DeliveryMethod>('HOME_DELIVERY')
const fieldErrors = reactive<Record<string, boolean>>({})
// 儲存時遇到 401（憑證過期或被作廢）才會設為 true，用來在表單內顯示
// 重新登入按鈕。見
// docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md 第四節。
const needsRelogin = ref(false)
```

- [ ] **Step 4: `startEditing` 重置 `needsRelogin`**

將 `src/components/OrderRecipientSection.vue:172-184` 現有的：

```ts
function startEditing() {
  formError.value = ''
  clearFieldErrors()
  // 進編輯模式就先抓門市清單，這樣使用者切到「門市自取」分頁時清單通常已經
  // 載好；loadStoreOptions() 內部有 idle/loading/loaded 狀態擋重複呼叫。
  void loadStoreOptions()

  const method = props.detail.deliveryMethod ?? 'HOME_DELIVERY'
  formMethod.value = method
  loadOriginalValuesFor(method)

  editing.value = true
}
```

改為：

```ts
function startEditing() {
  formError.value = ''
  needsRelogin.value = false
  clearFieldErrors()
  // 進編輯模式就先抓門市清單，這樣使用者切到「門市自取」分頁時清單通常已經
  // 載好；loadStoreOptions() 內部有 idle/loading/loaded 狀態擋重複呼叫。
  void loadStoreOptions()

  const method = props.detail.deliveryMethod ?? 'HOME_DELIVERY'
  formMethod.value = method
  loadOriginalValuesFor(method)

  editing.value = true
}
```

- [ ] **Step 5: `cancelEditing` 重置 `needsRelogin`**

將 `src/components/OrderRecipientSection.vue:186-189` 現有的：

```ts
function cancelEditing() {
  editing.value = false
  formError.value = ''
}
```

改為：

```ts
function cancelEditing() {
  editing.value = false
  formError.value = ''
  needsRelogin.value = false
}
```

- [ ] **Step 6: `handleSave` 開頭重置 `needsRelogin`**

將 `src/components/OrderRecipientSection.vue:280-286` 現有的：

```ts
async function handleSave() {
  formError.value = ''
  if (!validate()) {
    formError.value = t('order.recipient.errors.invalidInfo')
    return
  }

  saving.value = true
```

改為：

```ts
async function handleSave() {
  formError.value = ''
  needsRelogin.value = false
  if (!validate()) {
    formError.value = t('order.recipient.errors.invalidInfo')
    return
  }

  saving.value = true
```

- [ ] **Step 7: `handleSave` 的 catch 分支新增 401 處理**

將 `src/components/OrderRecipientSection.vue:308-338` 現有的：

```ts
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
```

改為：

```ts
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
      } else if (status === 401) {
        // 客戶授權憑證於送出當下已失效（過期或被後端作廢）。sessionHttp 的
        // response interceptor 已同步清除本地憑證並設定 exchangeError，
        // 這裡另外顯示表單內專屬提示與重新登入按鈕，讓使用者不必往下找
        // OrderView 下方的全域提示（該區塊在 deliveryDetail 存在時會被
        // 抑制，見
        // docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md）。
        formError.value = t('order.recipient.errors.sessionExpired')
        needsRelogin.value = true
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
```

- [ ] **Step 8: 模板新增重新登入按鈕**

將 `src/components/OrderRecipientSection.vue:478` 現有的：

```html
      <p v-if="formError" class="font-body-md text-xs text-primary">{{ formError }}</p>

      <div class="flex gap-3">
```

改為：

```html
      <p v-if="formError" class="font-body-md text-xs text-primary">{{ formError }}</p>
      <button
        v-if="needsRelogin"
        type="button"
        class="w-full bg-primary text-white px-6 py-3 font-label-caps text-label-caps tracking-widest hover:bg-primary-container transition-colors duration-300"
        @click="relogin"
      >
        {{ $t('order.session.loginButton') }}
      </button>

      <div class="flex gap-3">
```

- [ ] **Step 9: 執行型別檢查**

Run: `npm run type-check`
Expected: 無新增錯誤。

- [ ] **Step 10: 手動驗證情境 B（憑證被作廢）**

對應 spec 驗證清單第 1、3 項。

1. Run: `npm run dev`，以已綁定且已完成 LINE 登入的狀態開啟一筆 Sales 訂單，確認收件資訊區塊（`OrderRecipientSection`）正常顯示。
2. 開啟瀏覽器 DevTools → Application/Storage → Session Storage，找到 key `realyou.customerSession`，將其 `token` 欄位改成任意無效字串（例如 `invalid-token-test`），保留 `expiresAt` 為未來時間，儲存變更。
3. 點擊「編輯」→ 修改任一欄位 → 點擊「儲存」。
4. Expected：
   - 表單內出現「您的 LINE 登入已過期，請重新登入後再儲存變更。」與「重新登入 LINE」按鈕（而非泛用的「發生錯誤」文字）。
   - 頁面下方**不會**同時出現另一顆重複的「重新登入 LINE」（`OrderView` 的 exchangeError 區塊因 `deliveryDetail` 存在而被抑制）。
5. 開啟 DevTools → Application → Session Storage，確認 `realyou.customerSession` 已被移除（`sessionHttp` 的 401 interceptor 呼叫 `clearStoredSession()` 的既有行為）。
6. 點擊「重新登入 LINE」按鈕，確認觸發 `relogin()`：Session Storage 中原本的（已清除的）憑證不會被 `ensureSession()` 快取路徑重新寫回，且流程會嘗試呼叫 `liff.login()`。

- [ ] **Step 11: Commit**

```bash
git add src/components/OrderRecipientSection.vue
git commit -m "fix: show relogin prompt in recipient form when save hits 401

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## 執行後續（不屬於任何單一 Task，最後一併確認）

- [ ] 依 spec 驗證清單第 5、6 項執行迴歸測試：完整走一次「未綁定 → 自動綁定 → 收件資訊區塊出現 → 編輯並儲存成功」，確認本次改動未破壞既有正常路徑；並確認 `NOT_LOGGED_IN` 沒有讓未綁定訂單的綁定區塊被 exchangeError 區塊搶走顯示（`v-if="!summary.isBound && !autoBindInProgress"` 優先於 `v-else-if="exchangeError && !deliveryDetail"` 的既有 template 結構本身保證了這點，僅需目視確認）。
- [ ] 依 spec「LIFF 環境差異」段落，安排在真實 LINE App 內（LIFF client）以及外部瀏覽器兩種環境下手動驗證 `relogin()` 的實際效果。若確認 LIFF client 內 `liff.logout()` 無效，回頭與使用者討論是否需要追加「顯示關閉視窗按鈕」的 fallback 分支（該分支不在本計畫範圍內，需另開任務）。
