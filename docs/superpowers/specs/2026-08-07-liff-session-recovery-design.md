# LINE 身分失效的復原路徑設計

## 背景

`src/views/OrderView.vue`（見 [[2026-07-23-liff-order-view-design]]、[[2026-07-25-order-auto-bind-design]]、[[2026-08-06-order-recipient-delivery-design]]）透過 `src/composables/useCustomerSession.ts` 取得客戶授權憑證。當 LINE 身分因任何原因失效時，頁面會落入「有錯誤文案、但沒有任何按鈕可按」的狀態——文案要求使用者重新登入 LINE，畫面上卻不存在登入入口。

讀碼盤點出四個死路，全部源自同一個缺口：**沒有任何地方提供「重新登入 LINE」的出路**。

| 代號 | 情境 | 目前行為 | 程式碼位置 |
|---|---|---|---|
| A | 已綁定訂單，LINE ID Token 過期（`liff.isLoggedIn()` 仍為 true） | 換發回 401 `INVALID_LINE_TOKEN` → `exchangeError.kind === 'identity'`。畫面顯示「LINE 身分驗證失敗，請重新登入 LINE。」但重試按鈕條件是 `kind === 'service'`，identity 下**沒有任何按鈕** | `OrderView.vue:394-411` |
| B | 憑證被後端主動作廢（`TOKEN_INVALIDATED`） | `sessionHttp` 的 401 interceptor 產出 identity 錯誤 → 同樣沒有按鈕。若 `deliveryDetail` 已載入，收件區塊仍留在畫面上，使用者按「編輯 → 儲存」會一路得到 generic 錯誤，永遠存不進去 | `useCustomerSession.ts:134-144`、`OrderRecipientSection.vue:332-335` |
| C | 未綁定訂單，ID Token 過期 | `handleBind` 的分歧條件是 `!isLiffLoggedIn`。Token 過期但 `isLoggedIn()` 仍為 true 時會跳過 `login()`，直接拿過期 token 送出 → 401 → 顯示「請重新登入 LINE 後再試一次」→ 再按一次仍相同。**這顆按鈕永遠不會帶使用者去登入** | `OrderView.vue:156-161` |
| D | 已綁定訂單，完全未登入 LINE（外部瀏覽器開啟連結） | `ensureSession()` 在 `!isLoggedIn` 時直接 `return null` 且**不設 `exchangeError`**。綁定區塊因 `isBound` 不顯示、exchangeError 區塊因無錯誤也不顯示 → **頁面下半部整片空白**，連按鈕都沒有 | `useCustomerSession.ts:194-197` |

本次目標：讓上述四種情境都有一條使用者可自行執行的復原路徑，且不製造新的死路。

## 使用環境

訂單連結在兩種環境下都會被開啟：LINE App 內建瀏覽器（LIFF client）與外部瀏覽器（連結被複製貼上）。兩種環境都必須能復原，這是設計必須容納兩套行為的原因（見「LIFF 環境差異」）。

## 決策

| 決策 | 選擇 | 理由 |
|---|---|---|
| 復原邏輯放在哪 | `useCustomerSession` 新增 `relogin()`，三個消費端共用 | composable 是唯一知道「身分為何失效」的地方，出路就該長在那裡。只在 `OrderView` 補按鈕無法修掉死路 D（根因在 composable），且 `OrderRecipientSection` 得重複一份判斷邏輯 |
| 觸發方式 | 顯示按鈕，由使用者點擊 | 自動重新登入體驗較順，但若登入回來 token 依舊無效會變成無限跳轉。手動觸發天然免疫此迴圈，故**不需要**任何迴圈計數器 |
| 表單資料保全 | 不做草稿暫存 | 儲存失敗時明確告知身分已過期並提供登入按鈕，接受跳轉後輸入內容消失、使用者重填一次。草稿還原需維護額外狀態，效益不足以支撐 |
| Token 過期判定 | 一律以後端回應的 401 為準 | 不在前端 decode ID Token 的 `exp`：不必信任裝置時鐘，也少一個依賴 |
| 全域攔截 + 全屏覆蓋層 | 不採用 | 訂單摘要走的是分享 token、不需要 JWT，覆蓋層會連訂單編號都一起蓋掉——用一個更大的死路換掉小的 |

## 設計

### 一、`useCustomerSession` 的變更

**新增 `relogin()`**，並納入 `useCustomerSession()` 的回傳值：

```ts
async function relogin(): Promise<void> {
  clearStoredSession()
  sessionReady.value = false
  const initOk = await ensureLiffInit()
  if (!initOk) {
    exchangeError.value = { kind: 'service' }
    return
  }
  if (liff.isLoggedIn()) liff.logout()
  liff.login({ redirectUri: window.location.href })
}
```

三個細節各自對應一個具體風險：

- **`clearStoredSession()` 必須在最前面。** 情境 B 下若不先清除，登入回來後 `ensureSession()` 會走 `readStoredSession()` 的快取路徑（`useCustomerSession.ts:187-191`，該函式只檢查 `expiresAt`、無從得知後端已作廢），直接沿用同一顆死憑證——使用者重新登入了卻毫無改變。
- **`liff.logout()` 必須在 `login()` 之前。** 情境 A/C 的處境正是「LIFF session 還在、但 ID Token 已過期」，此時直接呼叫 `login()` 有機會被 SDK 判定為已登入而立即導回，回來取得同一顆過期 token——使用者按了按鈕、畫面閃一下、又回到同一個錯誤畫面。那會是設計本身製造出來的第五個死路。
- **`redirectUri` 使用 `window.location.href`**，含 `?t=` query param，登入後回到同一張訂單。`login()` 之後會整頁跳轉，函式不會回到呼叫端。

**修正死路 D 的根因**：`ensureSession()` 中 `!isLiffLoggedIn` 的分支（`useCustomerSession.ts:194-197`）改為設定錯誤後再回傳：

```ts
if (!isLiffLoggedIn.value) {
  exchangeError.value = { kind: 'identity', code: 'NOT_LOGGED_IN' }
  return null
}
```

此改動不影響既有流程：未綁定訂單時，模板的綁定區塊是 `v-if`、exchangeError 區塊是 `v-else-if`，綁定區塊仍優先顯示；`handleBind` 開頭只攔截 `kind === 'service'`（`OrderView.vue:149-152`），不會被新的 identity 錯誤擋下。

`ExchangeError.code` 的值域與對應處置：

| code | 意義 | 重新登入是否有解 |
|---|---|---|
| `INVALID_LINE_TOKEN` | LINE ID Token 驗證失敗（後端 401） | 是 |
| `TOKEN_INVALIDATED` | 憑證被後端主動作廢（前端自訂碼） | 是 |
| `NOT_LOGGED_IN` | 尚未登入 LINE（本次新增） | 是 |
| `NOT_BOUND` | 該 LINE 帳號尚未完成綁定（後端 403） | **否**，需先完成綁定 |

前三者構成「重新登入可解」的界線，是後續三處 UI 判斷的共同依據。

### 二、`OrderView` 的 exchangeError 區塊

`OrderView.vue:394-411` 的按鈕條件由單一 `kind === 'service'` 擴充為三選一：

| 狀態 | 文案 | 按鈕 |
|---|---|---|
| `kind: 'service'` | `order.session.errorService` | 重試 → `ensureSession()`（維持現狀） |
| `INVALID_LINE_TOKEN` / `TOKEN_INVALIDATED` | `order.session.errorIdentity` | 重新登入 LINE → `relogin()` |
| `NOT_LOGGED_IN` | `order.session.loginRequired`（新增） | 重新登入 LINE → `relogin()` |
| `NOT_BOUND` | `order.session.bindRequired` | 無（維持現狀，重新登入無法解決） |

新增 i18n key（`src/i18n.ts`，en 與 zh-TW 各一份）：

- `order.session.loginRequired` — 尚未登入 LINE 的提示。既有 `errorIdentity` 的語意是「驗證失敗」，套在「根本還沒登入」上並不正確，故分開。
- `order.session.loginButton` — 「重新登入 LINE」按鈕文字。

第四節另需新增 `order.recipient.errors.sessionExpired`。本次共新增三個 key，各需 en 與 zh-TW 兩份。

### 三、綁定按鈕

新增 `bindNeedsRelogin` ref。`handleBind` 與 `attemptAutoBind` 收到 `INVALID_LINE_TOKEN` 時設為 `true`；按鈕在該狀態下文字改為 `order.session.loginButton`、點擊改呼叫 `relogin()`。

這是死路 C 的正解：分歧點從「`isLiffLoggedIn` 是否為 false」移到「後端是否已表明這顆 token 不能用」。`handleBind` 原本 `!isLiffLoggedIn → login()` 的路徑保留不動，它處理的是另一種情況（確實未登入）。

`attemptAutoBind` 遇到 `INVALID_LINE_TOKEN` 時**要顯示 `bindError`**，不再靜默吞掉。理由與 `PERMANENT_BIND_CONFLICT_CODES`（`OrderView.vue:117-121`）同源：靜默重試無法解決，需要使用者動作；且若不顯示訊息，按鈕會無緣無故變成「重新登入 LINE」卻不說明原因。訊息沿用既有的 `order.bind.errors.invalidLineToken`。

### 四、`OrderRecipientSection` 儲存遇 401

`OrderRecipientSection.vue:332-335` 目前 401 落入 else 分支、顯示 generic 的「發生錯誤，請稍候再試」。改為獨立分支：

- `status === 401` → `formError` 顯示新增的 `order.recipient.errors.sessionExpired`，並設 `needsRelogin` 為 true
- 表單底部在 `needsRelogin` 為 true 時顯示一顆「重新登入 LINE」按鈕（呼叫 composable 的 `relogin()`）

**重複入口的處理**：`sessionHttp` 的 401 interceptor 會同時設定 `exchangeError`，而訂單已綁定時 `OrderView` 下方的 exchangeError 區塊也會亮起，畫面上將出現兩個「重新登入 LINE」入口。決議是 **`deliveryDetail` 存在時抑制下方的 exchangeError 區塊**，讓表單內的提示獨佔——使用者的注意力在表單上，下方那顆距離遠且重複陳述同一件事。實作上於 `OrderView.vue:394` 的 `v-else-if` 追加條件即可，不需引入跨元件狀態。

## LIFF 環境差異（實作階段必須驗證的假設）

`liff.logout()` 在 LINE App 內建瀏覽器（LIFF client）中的行為與外部瀏覽器不同，LINE 官方文件對在 LIFF browser 內呼叫 logout 有所保留。**本設計未在真機驗證過此行為。**

可能的失敗結果：LIFF client 內 logout 無效 → `login()` 取回同一顆過期 token → 死路 A/C 在該環境下依舊存在。

因應方式：實作階段以真機驗證 LIFF client 內的 `relogin()`。若確認無效，該環境下改為顯示「請關閉視窗後從 LINE 訊息重新開啟」並沿用既有的關閉視窗按鈕（`isInLiffClient` 與 `closeLiffWindow` 已存在於 `OrderView.vue:301-307`，目前僅掛在頂層 error 畫面）。

實務上這條 fallback 未必會用到——LIFF client 內 `isLoggedIn()` 通常恆為 true 且 SDK 會自行續期，死路 A/C 主要發生在外部瀏覽器。但兩種環境都有真實使用者，不能只賭一邊。

## 驗證方式

專案未配置測試框架與 lint script，以下為手動驗證清單，依可重現程度分級。

**可穩定重現（必驗）**

1. **情境 B / `TOKEN_INVALIDATED`** — 手動修改 `sessionStorage` 中 `realyou.customerSession` 的 `token` 為格式合法但無效的字串，`expiresAt` 保留未來時間（讓前端誤認 session 有效、由後端回 401）。一次可驗證三件事：下方區塊出現重新登入按鈕、表單儲存落入 401 分支、以及「抑制下方區塊」的取捨是否如預期。
2. **情境 D / `NOT_LOGGED_IN`** — 以外部瀏覽器開啟已綁定訂單的連結且不登入 LINE。確認畫面從「整片空白」變為「提示 + 登入按鈕」。
3. **`clearStoredSession()` 的必要性** — 在情境 B 的狀態下點擊重新登入，回來後確認 `sessionStorage` 存的是新憑證而非原本那顆。

**難以人工重現（需後端配合或程式碼審查）**

4. **情境 A / C 的 `INVALID_LINE_TOKEN`** — 需要「LIFF session 仍在但 ID Token 已過期」的真實狀態，無法隨手製造。務實做法是請後端暫時對 bind／member-login 回傳 401 + `INVALID_LINE_TOKEN` 以驗證前端分支；LIFF SDK 的真實過期行為併入上節的真機驗證一起處理。

**迴歸驗證**

5. 既有正常路徑不得損壞：未綁定 → 自動綁定 → 收件資訊區塊出現 → 編輯並儲存成功。
6. 特別確認新增的 `NOT_LOGGED_IN` 未使未綁定訂單的綁定區塊被 exchangeError 區塊搶走顯示。

## 不在本次範圍

- 表單草稿的暫存與還原
- 自動重新登入（含任何形式的迴圈計數器）
- 後端對 ID Token 續期機制的調整
- `NOT_BOUND` 情境的流程改善（該情境下綁定區塊已優先顯示，實務上罕見）
