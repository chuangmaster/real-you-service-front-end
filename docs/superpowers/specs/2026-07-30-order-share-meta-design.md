# Spec: LIFF `/order` 分享連結 Meta 資訊修正

- **Date**: 2026-07-30
- **Topic**: LIFF Order Share Metadata

## 1. 問題

業務/客服將訂單的 LIFF 分享連結（`liff.line.me/{VITE_LIFF_ID}?t={token}`，會被 LINE 導向本專案的 `/order?t={token}`）貼到 LINE 聊天室時，預覽卡片顯示錯誤、與訂單無關的固定標題「REAL YOU | Luxury Authentication Report」，且描述文字是 LINE 的預設 fallback「點選此處以開啟此連結。」。

根因：本專案是純前端 SPA，`index.html` 過去只有一組寫死的 `<title>`，完全沒有 `og:title`/`og:description`。LINE 的連結預覽爬蟲（User-Agent 內含 `Linespider`）**不會執行 JS**，只會抓取當下的靜態 HTML，在沒有 `og:title` 時退而使用 `<title>` 內容——這與 `docs/superpowers/specs/2026-07-05-product-share-route-design.md` 當初解決 `/product/{id}/share` 的架構限制完全相同。

## 2. 與 `/product/{id}/share` 的關鍵差異

`/product/{id}/share` 之所以能讓 nginx **無條件**、**不分 User-Agent** 直接 proxy 到後端 server-render HTML，是因為它是一個獨立、只給分享/QR 用途的網址，跟真人互動用的 `/product/:id` 是兩個不同路徑，彼此互不影響。

`/order` 沒有這種區隔：真人在 LIFF 內建瀏覽器開啟、與 LINE 的預覽爬蟲抓取，打的是**同一個** `/order?t=...` 網址。若比照 product-share 做法無條件 proxy，會讓真人使用者永遠拿不到互動用的 SPA（訂單摘要、LINE 綁定流程整個失效)。

因此 `/order` 的解法必須**依 User-Agent 分流**：只有比對到 LINE 官方預覽爬蟲的 UA（`Linespider`）才 proxy 到後端 server-render 的內容，其餘一律照舊走 SPA。

**重要邊界**：LIFF 內建瀏覽器本身的 User-Agent 也含有 `Line/`（不是 `Linespider`），比對規則必須精確匹配 `Linespider` 這個字串，不能用寬鬆的 `Line` 子字串比對，否則會誤判真實客戶的 LIFF 瀏覽器為爬蟲，導致綁定流程整個打不開。

## 3. 變更內容

### `nginx.conf`
新增 `map $http_user_agent $is_link_preview_bot`（`~*Linespider` → 1），並將 `/order` 從原本吃 `location /` catch-all 改為明確的 `location = /order`：命中 bot UA 時 `rewrite ^ /__order-share last`，導向一個新的 `internal` location，proxy 到 `${API_TARGET_URL}/api/public/orders/share?t=$arg_t`（`$arg_t` 是 nginx 內建的 query-string 變數，用來把 token 原封不動帶過去）；沒命中則照舊 `try_files ... /index.html`。

### `vite.config.ts`
本地開發用 Vite proxy 的 `bypass` function 達成同樣的 UA 分流（Vite 沒有 `map`/`if`，用 JS 判斷取代）。

### `index.html`
把過去全站共用、寫死且錯誤的 `<title>REAL YOU | Luxury Authentication Report</title>` 改成中性品牌名 `REAL YOU`，並補上基本的 `og:title`/`og:description`/`og:type`/`twitter:card`。這是非 JS 爬蟲在 UA 分流未命中、或後端端點尚未上線時看到的**唯一**保底內容，因此刻意維持中性、不含任何頁面專屬資訊。

### 動態頁面標題（`src/router/index.ts` + 各 View）
真人使用者的瀏覽器分頁標題（以及依賴當下 DOM 的原生分享功能，例如手機瀏覽器的分享選單）改用路由層級的 `route.meta.title` 預設值，並在資料載入完成後由頁面自行覆寫成更精確的內容：
- `ProductDetailView.vue`：`REAL YOU | {brandName} {styleName} 鑑定證書`
- `OrderView.vue`：`REAL YOU | 訂單 #{orderNumber}`

這與 UA 分流是兩件事——JS 執行後的 `document.title` 更新只對真人瀏覽器有效，不影響非 JS 爬蟲看到的預覽卡片內容。

## 4. 後端相依（不在本 repo 範圍內）

需要後端新增 `GET /api/public/orders/share?t={token}`（比照既有 `/api/public/inventory/{id}/share` 的慣例），回傳 server-rendered HTML，`<title>`/`og:title`/`og:description` 內容規則：
- 只放 **訂單編號 + 商品品牌/款式**（例：`REAL YOU | 訂單 #A20260730001` / `CHANEL Classic Flap 等 2 件商品`）。
- **不可包含 `customerName`**（客戶姓名）——分享卡片是任何看到該則訊息的人都能看到，不限收件人，放客戶姓名有 PII 曝光風險。
- 無效/過期 token 的行為比照既有 `GET /api/public/orders/view` 的 404 慣例。

在後端端點上線前，nginx/vite 的路由分流可以先用 stub 驗證行為正確；完整的 LINE 預覽卡片端到端驗證要等後端端點就緒。

## 5. 驗證方式

用 `docker run nginx:stable-alpine` + envsubst 渲染後的 `nginx.conf`，搭配一個回傳固定內容並記錄請求路徑的 stub 後端，驗證四種情境：
1. 一般瀏覽器 UA 打 `/order?t=xxx` → 拿到 SPA `index.html`。
2. `Linespider` UA 打 `/order?t=xxx` → 被 proxy 到 stub，且 stub 收到的路徑是 `/api/public/orders/share?t=xxx`。
3. 偽造的 LIFF 瀏覽器 UA（含 `Line/13.5.0` 但不含 `Linespider`）打 `/order?t=xxx` → 仍拿到 SPA，確認不會誤傷真人流程。
4. `/product/{id}/share` 行為不受影響。

以上四項已於本次修改中實際跑過（見對應 commit）。
