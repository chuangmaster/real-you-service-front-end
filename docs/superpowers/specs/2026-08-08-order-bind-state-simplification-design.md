# 訂單頁面綁定狀態機簡化設計

## 背景

起因是一個架構提案：能否放棄「LINE ID Token 換發後端自製 JWT」這道手續，直接拿 `liff.getIDToken()` 取得的 LINE ID Token 當作 API 存取的唯一憑證，藉此減少 `useCustomerSession.ts`（見 `specs/001-liff-jwt-login/`）與 [[2026-08-07-liff-session-recovery-design]] 累積出來的一堆身分類錯誤分支與 `relogin()` 復原邏輯。

查證後判斷此提案**不成立**，原因記錄於「已否決的替代方案」一節。回頭盤點使用者實際遇到的異常狀態，定位出 `src/views/OrderView.vue` 裡兩個具體、可獨立修正的問題，構成本次設計的範圍：

1. **自動綁定（`attemptAutoBind()`）與換發（`ensureSession()`）並行執行、互相搶同一組畫面狀態**，會在特定時序下短暫閃現「尚未綁定」的錯誤文案。
2. **「訂單綁定狀態」（`summary.isBound`，來自 `GET /api/public/orders/view`）與「LINE 身分綁定狀態」（`exchangeError.code === 'NOT_BOUND'`，來自 `POST /api/public/member/login`）是兩套獨立系統，UI 卻假設兩者永遠一致**——當訂單已被某個 LINE 身分綁定過、而目前開啟頁面的是另一個從未綁定過的 LINE 身分時，畫面會卡在「此 LINE 帳號尚未完成綁定，請先透過訂單連結完成綁定」，但該提示要求的動作（透過訂單連結綁定）使用者當下人就在訂單連結頁面上，無法執行，且畫面上沒有任何按鈕——死路。

兩者都只涉及 `src/views/OrderView.vue` 與 `src/i18n.ts`，不涉及後端。

## 已否決的替代方案：LINE ID Token 直接當 API 存取憑證

**方案**：拔掉 `POST /api/public/member/login` 換發步驟，`sessionHttp` 的 request interceptor 改成每次請求即時呼叫 `liff.getIDToken()` 帶原始 LINE ID Token，後端受保護端點改為直接驗證 LINE ID Token（驗簽或呼叫 LINE 官方驗證端點）。

**否決理由**：LINE ID Token 簽發後固定 **1 小時過期，且 LIFF SDK 無任何刷新機制**——`liff.getIDToken()` 過期後會持續回傳同一顆已過期的 token，直到使用者重新登入（[LIFF API reference](https://developers.line.biz/en/reference/liff/)、[LIFF ID Token 有効期限切れ対策](https://zenn.dev/arahabica/articles/274bb147a91d8a)）。這代表：

- 目前四種身分類錯誤（`INVALID_LINE_TOKEN` / `NOT_LOGGED_IN` / `NOT_BOUND` / `TOKEN_INVALIDATED`）裡，有三種（`INVALID_LINE_TOKEN`、`NOT_LOGGED_IN`，以及本質上的 `NOT_BOUND`）的根因是「LINE 身分本身的生命週期」，跟前端要不要多包一層自製 JWT 無關——換掉憑證機制並不會讓 `relogin()` 這套復原流程變少或消失。
- 唯一會消失的是 `TOKEN_INVALIDATED`（後端主動作廢自製 JWT 的能力），但代價是後端同時失去「客戶密碼異動時可立即撤銷既有 session」的能力（`specs/001-liff-jwt-login/spec.md` FR-009 當初能接受「解綁後憑證可沿用至自然過期」這個 30 分鐘風險窗口，前提正是自製 JWT 給了後端主動作廢的手段）。
- 换成直接驗證 LINE ID Token，後端每個受保護請求都要多做一次第三方 token 驗證與「LINE 使用者 ID → 客戶」的查找，且無法在自製 JWT 裡快取這個查找結果。

結論：不值得為了消掉一種錯誤分類、換來後端驗證成本與主動撤銷能力的損失，且無法解決佔多數的另外三種異常狀態。**本次不變更前後端之間的授權憑證機制**，`POST /api/public/member/login` 換發 JWT 的既有設計維持不動。

## 一、拔除自動綁定

`src/views/OrderView.vue` 移除：

- `attemptAutoBind()` 函式整個刪除。
- `autoBindInProgress` ref 刪除。
- `onMounted` 內呼叫 `attemptAutoBind()` 的那行刪除。

BIND SECTION 的顯示條件簡化：

```diff
- <div v-if="!summary.isBound && !autoBindInProgress" ...>
+ <div v-if="!summary.isBound" ...>
```

綁定完全收斂成 `handleBind()`（使用者點擊觸發）這一條路徑，其既有邏輯不需改動：

- 未登入 LINE → `login()` 整頁導轉，登入完成後導回同一網址（含 `?t=`）。
- 已登入 LINE → 直接呼叫 `POST /api/public/orders/bind`，並沿用既有的 `resolveBindErrorMessage()` / `bindNeedsRelogin` 錯誤處理（`INVALID_LINE_TOKEN` → 導向重新登入；`LINE_ALREADY_BOUND` / `CUSTOMER_ALREADY_BOUND` → 顯示永久性衝突錯誤）。

`attemptAutoBind()` 裡原本重複的一份錯誤分類邏輯（`PERMANENT_BIND_CONFLICT_CODES` 判斷、靜默吞掉暫時性錯誤）隨函式一併刪除，不需要遷移到別處——`handleBind()` 本來就有對等邏輯，現在是唯一使用到的一份。

**體感改變**：已登入 LINE 的客戶開啟未綁定訂單頁時，需要手動點一次「同意綁定」按鈕，不再是先前 [[2026-07-25-order-auto-bind-design]] 引入的靜默自動綁定。這是拿掉自動化換取狀態機簡化的取捨，已與使用者確認可接受。

**連帶效果**：`onMounted` 內 `ensureSession()`（並行於 `fetchOrderSummary()` 執行）不再需要與一個接續執行的背景自動綁定流程搶著寫入 `exchangeError` / `bindError` 等畫面狀態，消除「換發先回 `NOT_BOUND`、自動綁定還在跑」時短暫閃現錯誤文案的競態。

## 二、修正死路 E：抱掉「訂單已綁定但目前身分未綁定」的提示區塊

**關鍵觀察**：完成「一」之後，BIND SECTION 的顯示條件是單純 `!summary.isBound`；下方 `exchangeError` 區塊是 `v-else-if`，只有在 `summary.isBound === true` 時才會被評估。也就是說 `exchangeError.code === 'NOT_BOUND'` **只可能在訂單已綁定的情況下洩漏給使用者看到**——訂單未綁定時 BIND SECTION 早就搶先顯示了綁定 CTA，`NOT_BOUND` 分支在 exchangeError 區塊裡從未有過對使用者有意義的用途。因此不需要額外判斷 `summary.isBound`，直接把 `NOT_BOUND` 整支從 exchangeError 區塊移除即可。

`src/views/OrderView.vue` 的 exchangeError 區塊，模板內的三元判斷：

```diff
  {{
-   exchangeError.code === 'NOT_BOUND'
-     ? $t('order.session.bindRequired')
-     : exchangeError.code === 'NOT_LOGGED_IN'
-       ? $t('order.session.loginRequired')
-       : exchangeError.kind === 'identity'
-         ? $t('order.session.errorIdentity')
-         : $t('order.session.errorService')
+   exchangeError.code === 'NOT_LOGGED_IN'
+     ? $t('order.session.loginRequired')
+     : exchangeError.kind === 'identity'
+       ? $t('order.session.errorIdentity')
+       : $t('order.session.errorService')
  }}
```

外層 `v-else-if` 的顯示條件本身新增排除 `NOT_BOUND`：

```diff
- <div v-else-if="exchangeError && !deliveryDetail" ...>
+ <div v-else-if="exchangeError && exchangeError.code !== 'NOT_BOUND' && !deliveryDetail" ...>
```

`order.session.bindRequired` 這個 i18n key（`src/i18n.ts` 的 `en` 與 `zh-TW` 各一份）因此不再被任何地方引用，一併刪除——比照 [[2026-07-25-order-auto-bind-design]] 當初拿掉 `order.bind.success` 的作法，不留無人引用的字串。

**效果**：已綁定訂單被另一個「曾登入過 LINE、但這個身分從未綁定過」的訪客開啟時（`exchangeError.code === 'NOT_BOUND'`），畫面只會顯示訂單摘要（品項、金額、狀態），不會出現任何錯誤或登入提示——與 `fetchOrderSummary()` 本來就不需要授權憑證這件事語意一致。`useCustomerSession.ts` 內部仍會把這個情況分類為 `exchangeError.value = { kind: 'identity', code: 'NOT_BOUND' }`（分類邏輯不變），只是 `OrderView.vue` 選擇不呈現它。

這個排除**不涵蓋**「完全未登入 LINE」的訪客：`ensureSession()` 對未登入狀態一律先設定 `exchangeError.value = { kind: 'identity', code: 'NOT_LOGGED_IN' }`（見 `useCustomerSession.ts` 的 `!isLiffLoggedIn.value` 分支），根本不會呼叫換發端點、也就不會產生 `NOT_BOUND`。`NOT_LOGGED_IN` 不在本次排除清單內，因此已綁定訂單被完全未登入 LINE 的訪客開啟時，畫面仍會顯示「請先登入 LINE 才能繼續」與可點擊的登入按鈕——這是刻意保留的行為，因為訂單真正的綁定者本人的 LIFF session 也可能已過期到完全登出的狀態，需要保留這個復原入口，見「四、驗證方式」第 5 項。

## 三、後端影響

**無**。本次兩項修正都只涉及 `src/views/OrderView.vue` 的元件邏輯／模板條件，以及 `src/i18n.ts` 刪除一組未使用的字串。實際呼叫的後端端點與其回應格式完全不變：

- `POST /api/public/orders/bind` 的請求/回應、錯誤碼（`INVALID_LINE_TOKEN` / `LINE_ALREADY_BOUND` / `CUSTOMER_ALREADY_BOUND`）不變，只是不再有一個額外的靜默呼叫端（`attemptAutoBind`），改為只由使用者點擊觸發。
- `POST /api/public/member/login` 的請求/回應、錯誤碼（含 403 `NOT_BOUND`）不變，前端仍會照常分類並設定 `exchangeError`，只是 `OrderView.vue` 不再把 `NOT_BOUND` 這一種呈現給使用者。

後端不需要移除或調整任何端點、錯誤碼或既有邏輯。

## 四、驗證方式

專案未配置測試框架與 lint script，以下為手動驗證清單：

1. **未綁定訂單、已登入 LINE** → 看到綁定按鈕，點擊後成功綁定，區塊消失，收件資訊區塊（若為 Sales 訂單）隨後出現。
2. **未綁定訂單、未登入 LINE** → 看到綁定按鈕，點擊後導轉登入；登入完成導回頁面後，仍需再點一次按鈕才會完成綁定（確認自動綁定確實已移除，非迴歸）。
3. **已綁定訂單、以綁定當下的同一 LINE 身分開啟** → 正常看到訂單摘要與收件資訊區塊（迴歸測試，確保沒有改壞既有正常路徑）。
4. **已綁定訂單、換一個曾登入過但未綁定過的 LINE 身分開啟** → 只看到訂單摘要，不出現任何錯誤或登入提示區塊（驗證死路 E 已修正）。
5. **已綁定訂單、完全未登入 LINE 開啟** → 會看到「請先登入 LINE 才能繼續」提示與可點擊的登入按鈕，**不是**摘要單獨顯示。這不是死路 E 的殘留，是刻意保留的行為：`ensureSession()` 在完全未登入時會直接設 `NOT_LOGGED_IN`，根本不會走到 `NOT_BOUND` 這條路，而 `NOT_LOGGED_IN` 不在本次排除清單內——訂單真正的綁定者本人也可能是這個狀態（例如 LIFF session 過期後完全登出），需要保留這個復原入口。
6. **已綁定訂單、同一身分但憑證 `TOKEN_INVALIDATED` 或 `INVALID_LINE_TOKEN`**（可比照 [[2026-08-07-liff-session-recovery-design]] 的驗證方式手動製造）→ 重新登入提示區塊仍正常出現、按鈕仍可用（確認步驟二新增的排除條件沒有誤殺其他身分類錯誤）。

## 不在此次範圍

- 後端 API、`ResponseCodes` 或授權憑證機制的任何異動——見「已否決的替代方案」。
- `src/components/OrderRecipientSection.vue` 的 401 處理邏輯——不受本次改動影響。
- 「訂單被別的 LINE 身分綁定後，是否應該開放重新綁定」這個業務問題的正面設計——本次選擇的做法是完全不呈現任何提示（連同 CTA 一起拿掉），而非設計一套「轉讓/重新綁定」流程；後者若未來有實際需求，需另開規格。
