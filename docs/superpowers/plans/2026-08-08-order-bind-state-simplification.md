# 訂單頁面綁定狀態機簡化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拔除 `OrderView.vue` 的自動綁定路徑（改為使用者手動點擊唯一觸發），並修正「訂單已被別的 LINE 身分綁定時，畫面卡在無法採取任何動作的『尚未綁定』提示」這個死路。

**Architecture:** 純前端改動，全部集中在 `src/views/OrderView.vue`（移除 `attemptAutoBind`／`autoBindInProgress` 及其相依的死碼、調整兩處模板顯示條件）與 `src/i18n.ts`（刪除一組不再被引用的字串）。不涉及後端 API、路由或其他元件。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript（`OrderView.vue` 內為 TS）、Vite、`@line/liff`、`axios`、`vue-i18n`。

## Global Constraints

- 專案未配置測試框架與 lint script（見 `CLAUDE.md`）；本計畫的自動化驗證僅止於 `npm run type-check`（`vue-tsc --noEmit`）與 `npm run build`，其餘一律為手動瀏覽器驗證。
- 註解與文件一律使用繁體中文，程式碼識別字（變數、函式名稱）使用英文，兩者不得混用（見 `CLAUDE.md` 語言規則）。
- 不得變更任何後端端點、`ResponseCodes` 或授權憑證機制——本次範圍純屬前端狀態機簡化（見 spec「已否決的替代方案」與「後端影響」兩節）。
- 每個 task 完成後即可獨立驗證、獨立 commit，不需等待另一個 task 完成。

**對應 spec：** `docs/superpowers/specs/2026-08-08-order-bind-state-simplification-design.md`

---

## Task 1: 拔除自動綁定，收斂為手動點擊唯一路徑

**Files:**
- Modify: `src/views/OrderView.vue`

**Interfaces:**
- Consumes：`useCustomerSession()` 既有回傳值（`sessionReady`、`isLiffLoggedIn`、`exchangeError`、`ensureSession`、`login`、`relogin`）——本 task 不改動這個 composable。
- Produces：BIND SECTION 的顯示條件收斂為 `!summary.isBound`，供 Task 2 接續使用；`attemptAutoBind`、`autoBindInProgress`、`PERMANENT_BIND_CONFLICT_CODES` 三個識別字自本 task 起不再存在於檔案中，後續 task 不可再引用。

- [ ] **Step 1: 移除 `autoBindInProgress` ref 宣告**

在 `src/views/OrderView.vue` 找到：

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

改為：

```ts
// Binding state
const binding = ref(false)
const bindError = ref('')
// INVALID_LINE_TOKEN 時，「再點一次原本的綁定按鈕」無法解決問題（會用
// 同一顆過期 token 再送一次、再失敗一次），需要引導使用者重新登入 LINE，
// 見 docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md 死路 C。
const bindNeedsRelogin = ref(false)
```

- [ ] **Step 2: 更新 `resolveBindErrorMessage` 上方註解，移除對 `attemptAutoBind` 的引用**

找到：

```ts
// POST /api/public/orders/bind 失敗時的錯誤碼 → 文案對照，供 handleBind（手動點擊）
// 與 attemptAutoBind（靜默自動綁定）共用，避免兩處各自維護一份相同的對照表。
const resolveBindErrorMessage = (code: string | undefined) => {
```

改為：

```ts
// POST /api/public/orders/bind 失敗時的錯誤碼 → 文案對照，供 handleBind 使用。
const resolveBindErrorMessage = (code: string | undefined) => {
```

- [ ] **Step 3: 刪除 `PERMANENT_BIND_CONFLICT_CODES`（Step 5 移除 `attemptAutoBind` 後，此常數已無任何消費端）**

找到：

```ts
// LINE_ALREADY_BOUND / CUSTOMER_ALREADY_BOUND：換一個 LINE 帳號或再點一次按鈕
// 都無法解決的永久性衝突，attemptAutoBind 靜默重試時如果遇到這兩種錯誤，
// 就不再照舊靜默吞掉，而是直接顯示錯誤（見
// docs/superpowers/specs/2026-07-25-order-auto-bind-design.md 的後續調整）。
const PERMANENT_BIND_CONFLICT_CODES = ['LINE_ALREADY_BOUND', 'CUSTOMER_ALREADY_BOUND']
```

整段刪除（含上方註解），只留下這段前後原有的空行各一行，不要留下連續兩個空行。

- [ ] **Step 4: 更新 `deliveryDetail` 上方註解，移除對 `attemptAutoBind` 的類比**

找到：

```ts
// Recipient/delivery detail state — only fetched for bound Sales orders once
// the customer has a valid session JWT. Silent-failure by design, same as
// attemptAutoBind's non-404 failures: the section just doesn't appear.
// See docs/superpowers/specs/2026-08-06-order-recipient-delivery-design.md.
const deliveryDetail = ref<SalesOrderDeliveryDetail | null>(null)
```

改為：

```ts
// Recipient/delivery detail state — only fetched for bound Sales orders once
// the customer has a valid session JWT. Silent-failure by design: the
// section just doesn't appear on failure.
// See docs/superpowers/specs/2026-08-06-order-recipient-delivery-design.md.
const deliveryDetail = ref<SalesOrderDeliveryDetail | null>(null)
```

- [ ] **Step 5: 刪除 `attemptAutoBind` 函式整個區塊**

找到（從函式上方註解到函式結尾的右大括號）：

```ts
// Silently completes binding when we already know the customer is logged
// into LINE, so they don't have to tap the button at all. Falls back to
// showing the manual button whenever login state can't be confirmed —
// see docs/superpowers/specs/2026-07-25-order-auto-bind-design.md.
const attemptAutoBind = async () => {
  if (!summary.value || summary.value.isBound) return
  if (!isLiffLoggedIn.value) return

  autoBindInProgress.value = true
  try {
    const lineIdToken = liff.getIDToken()
    const response = await axios.post('/api/public/orders/bind', {
      t: token.value,
      lineIdToken
    })

    if (response.data && response.data.success) {
      summary.value.isBound = true
      // 理由同 handleBind：綁定前的 ensureSession() 很可能因尚未綁定而失敗，
      // 這裡需重新呼叫一次才能讓 maybeFetchDeliveryDetail() 真正抓到資料。
      ensureSession()
        .then(() => maybeFetchDeliveryDetail())
        .catch((err) => console.error('Failed to refresh session after bind:', err))
    }
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
}
```

整個區塊刪除，只留下前後原有的一個空行分隔（緊接在後的是 `const formatCurrency = ...`）。

- [ ] **Step 6: `onMounted` 移除 `attemptAutoBind()` 呼叫**

找到：

```ts
onMounted(async () => {
  await Promise.all([fetchOrderSummary(), ensureSession()])
  try {
    isInLiffClient.value = liff.isInClient()
  } catch {
    isInLiffClient.value = false
  }
  attemptAutoBind()
  maybeFetchDeliveryDetail()
})
```

改為：

```ts
onMounted(async () => {
  await Promise.all([fetchOrderSummary(), ensureSession()])
  try {
    isInLiffClient.value = liff.isInClient()
  } catch {
    isInLiffClient.value = false
  }
  maybeFetchDeliveryDetail()
})
```

- [ ] **Step 7: 簡化 BIND SECTION 的模板顯示條件**

找到：

```html
      <div v-if="!summary.isBound && !autoBindInProgress" class="bg-white border border-outline-variant/30 shadow-sm p-6 text-center">
```

改為：

```html
      <div v-if="!summary.isBound" class="bg-white border border-outline-variant/30 shadow-sm p-6 text-center">
```

- [ ] **Step 8: 型別檢查**

Run: `npm run type-check`
Expected: 無錯誤輸出（`vue-tsc --noEmit` 成功結束，沒有提及 `attemptAutoBind`、`autoBindInProgress`、`PERMANENT_BIND_CONFLICT_CODES` 未定義或未使用的錯誤）。

- [ ] **Step 9: build 驗證**

Run: `npm run build`
Expected: build 成功完成，無 Vue 模板編譯錯誤（確認 Step 7 的模板改動語法正確）。

- [ ] **Step 10: 手動瀏覽器驗證**

此步驟需要人工在瀏覽器操作，無法由執行 agent 自動化完成——若使用 subagent-driven-development 執行本計畫，這一步應標記為需要人類接手驗證，而非視為自動失敗。

Run: `npm run dev`，透過一個尚未綁定、`t` 參數有效的訂單分享連結開啟 `OrderView.vue`（`/order?t=<有效 token>`）：

1. 已登入 LINE 的情況下開啟頁面 → 確認畫面顯示「同意綁定」按鈕，且**不會**自動完成綁定（按鈕維持在畫面上，直到手動點擊）。
2. 點擊按鈕 → 確認綁定成功後按鈕區塊消失，若為 Sales 訂單則收件資訊區塊隨後出現。
3. 未登入 LINE 的情況下開啟另一張未綁定訂單頁面 → 點擊按鈕觸發 LINE 登入導轉，登入完成導回頁面後，確認**仍需要再點一次按鈕**才會完成綁定（用來確認自動綁定確實已移除，而非殘留的隱性行為）。

- [ ] **Step 11: Commit**

```bash
git add src/views/OrderView.vue
git commit -m "refactor: remove silent auto-bind, keep manual click as sole bind path

拔除 attemptAutoBind()／autoBindInProgress 及其專屬的
PERMANENT_BIND_CONFLICT_CODES 死碼，消除它與 ensureSession() 並行執行
時互搶畫面狀態的 race condition。見
docs/superpowers/specs/2026-08-08-order-bind-state-simplification-design.md。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: 修正死路 E——抱掉「訂單已綁定但目前身分未綁定」的提示區塊

**Files:**
- Modify: `src/views/OrderView.vue`
- Modify: `src/i18n.ts`

**Interfaces:**
- Consumes：Task 1 完成後的 BIND SECTION 顯示條件（`!summary.isBound`），以及既有的 `exchangeError: Ref<{ kind: 'identity' | 'service'; code?: string } | null>`（來自 `useCustomerSession()`，本 task 不改動其型別或分類邏輯，`useCustomerSession.ts` 完全不動）。
- Produces：exchangeError 區塊不再呈現 `NOT_BOUND`；`order.session.bindRequired` 這個 i18n key 自本 task 起不再存在於 `src/i18n.ts`，後續不可再引用。

- [ ] **Step 1: 更新 exchangeError 區塊的說明註解與顯示條件**

在 `src/views/OrderView.vue` 找到（緊接在 BIND SECTION 之後）：

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
```

改為：

```html
      <!-- CUSTOMER SESSION EXCHANGE ERROR（客戶授權憑證換發失敗，FR-006）
           擇一顯示：綁定區塊優先，避免使用者尚未綁定時同時看到「請先綁定」
           與這裡的換發失敗訊息（兩者語意重疊或互相矛盾）。綁定完成之後，
           才輪到這裡呈現換發失敗的狀態。
           排除 NOT_BOUND：BIND SECTION 用 !summary.isBound 判斷是否顯示，
           這裡是 v-else-if，只有在 summary.isBound === true 時才會被評估
           到，此時 exchangeError.code === 'NOT_BOUND' 代表「訂單已被另一個
           LINE 身分綁定，目前這個身分沒綁過」，不是使用者能自行解決的狀態
           （無法二次綁定同一張訂單），顯示「請先完成綁定」反而誤導使用者
           以為有動作可做。見
           docs/superpowers/specs/2026-08-08-order-bind-state-simplification-design.md
           死路 E。
           deliveryDetail 存在時（收件資訊表單已顯示）額外抑制這個區塊——
           表單儲存 401 時會在表單內自己顯示重新登入提示（見
           OrderRecipientSection.vue），這裡若同時顯示會出現兩顆重複的
           「重新登入 LINE」按鈕，見
           docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md
           第二節「重複入口的處理」。 -->
      <div
        v-else-if="exchangeError && exchangeError.code !== 'NOT_BOUND' && !deliveryDetail"
        class="bg-white border border-outline-variant/30 shadow-sm p-6 text-center mt-4"
      >
```

- [ ] **Step 2: 移除文案三元判斷裡的 `NOT_BOUND` 分支**

在同一個區塊內找到：

```html
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
```

改為：

```html
        <p class="font-body-md text-sm text-primary mb-4">
          {{
            exchangeError.code === 'NOT_LOGGED_IN'
              ? $t('order.session.loginRequired')
              : exchangeError.kind === 'identity'
                ? $t('order.session.errorIdentity')
                : $t('order.session.errorService')
          }}
        </p>
```

- [ ] **Step 3: 刪除 `en` 語系的 `bindRequired`**

在 `src/i18n.ts` 找到（`order.session` 區塊內）：

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

改為：

```ts
      session: {
        errorIdentity: 'LINE identity verification failed. Please log in to LINE again.',
        errorService: 'Service is temporarily unavailable. Please try again later.',
        retry: 'RETRY',
        loginRequired: 'Please log in to LINE to continue.',
        loginButton: 'LOG IN TO LINE'
      },
```

- [ ] **Step 4: 刪除 `zh-TW` 語系的 `bindRequired`**

在 `src/i18n.ts` 找到（`order.session` 區塊內）：

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

改為：

```ts
      session: {
        errorIdentity: 'LINE 身分驗證失敗，請重新登入 LINE。',
        errorService: '服務暫時無法使用，請稍後再試。',
        retry: '重試',
        loginRequired: '請先登入 LINE 才能繼續。',
        loginButton: '重新登入 LINE'
      },
```

- [ ] **Step 5: 確認沒有殘留的引用**

Run: `grep -rn "bindRequired" src/`
Expected: 沒有任何輸出（確認 Step 2～4 已移除所有引用與定義，不留死碼）。

- [ ] **Step 6: 型別檢查**

Run: `npm run type-check`
Expected: 無錯誤輸出。

- [ ] **Step 7: build 驗證**

Run: `npm run build`
Expected: build 成功完成。

- [ ] **Step 8: 手動瀏覽器驗證**

此步驟需要人工在瀏覽器操作，無法由執行 agent 自動化完成。

透過 `npm run dev`，需要一張**已綁定**的訂單（例如 Task 1 驗證步驟裡剛綁定的那張）：

1. 用綁定當下同一個 LINE 身分重新開啟訂單頁面 → 確認訂單摘要與收件資訊區塊正常顯示（迴歸測試，確認 Step 1 的條件改動沒有影響到正常路徑）。
2. 換一個曾登入過但未曾綁定過的 LINE 身分開啟同一張訂單頁面 → 確認畫面只顯示訂單摘要（品項、金額、狀態），**不出現**任何錯誤或登入提示區塊。
3. 在無痕視窗內完全不登入 LINE 直接開啟同一張訂單頁面 → 確認畫面顯示「請先登入 LINE 才能繼續」提示與可點擊的登入按鈕，**不是**摘要單獨顯示（`NOT_LOGGED_IN` 不受本次排除條件影響，是刻意保留給訂單真正綁定者本人的復原入口，見 spec 的「四、驗證方式」第 5 項）。
4. 若可行，比照 `docs/superpowers/specs/2026-08-07-liff-session-recovery-design.md` 的手動驗證方式，將 `sessionStorage` 中 `realyou.customerSession` 的 `token` 改成格式合法但無效的字串（`expiresAt` 保留未來時間）後重新整理已綁定訂單頁面 → 確認 `TOKEN_INVALIDATED` 觸發的「重新登入 LINE」提示區塊仍正常出現、按鈕仍可點擊（確認 Step 1 新增的 `NOT_BOUND` 排除條件沒有連帶擋掉其他身分類錯誤）。

- [ ] **Step 9: Commit**

```bash
git add src/views/OrderView.vue src/i18n.ts
git commit -m "fix: stop showing dead-end NOT_BOUND prompt on already-bound orders

訂單已被另一個 LINE 身分綁定時，NOT_BOUND 換發錯誤無法透過任何使用者
動作解決（無法二次綁定同一張訂單），顯示「請先完成綁定」的提示反而
誤導使用者。改為完全不呈現，畫面只剩訂單摘要。移除連帶變成死碼的
order.session.bindRequired（en/zh-TW）。見
docs/superpowers/specs/2026-08-08-order-bind-state-simplification-design.md
死路 E。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage**：spec 的「一、拔除自動綁定」對應 Task 1；「二、修正死路 E」對應 Task 2；「三、後端影響」不需要任何 task（無後端改動）；「已否決的替代方案」是決策紀錄，不需要實作 task。spec 列出的所有 diff 與連帶的死碼清理（`PERMANENT_BIND_CONFLICT_CODES`、`bindRequired`、相關過期註解）均已對應到具體 step。
- **Placeholder scan**：所有 step 均附完整的 before/after 程式碼區塊，無「TBD」、「加上適當的錯誤處理」等空泛描述；手動驗證步驟已明確標註需要人工介入，而非留白帶過。
- **Type consistency**：Task 2 沿用 Task 1 完成後的 `!summary.isBound` 條件與既有的 `exchangeError` 型別（`kind`/`code`），未新增任何函式或型別，沒有跨 task 命名不一致的風險。
