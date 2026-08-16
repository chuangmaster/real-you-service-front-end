# 證書頁路由改名為 identification-report 命名空間

## 背景

`docs/superpowers/specs/2026-08-16-brand-homepage-redesign-design.md` 把原本首頁的 UUID 搜尋表單搬到新路由 `/identification-report`，但當時**沒有**連動調整證書頁本身的路由（仍是 `/product/:id`，分享連結仍是 `/product/:id/share`）。這造成命名不一致：搜尋入口叫 `identification-report`，搜尋出來的結果頁卻叫 `product`。

本次要把證書頁的**對外 URL 路徑**也改成 `identification-report` 命名空間下，讓「搜尋 → 結果」在網址上有清楚的父子關係，同時為舊路徑加上轉發，避免任何已存在或未來才發現的舊連結失效。

**目前沒有已經印製成實體卡片、或已經傳送給客戶的正式 QR code／分享連結**——這代表本次改動理論上不會立即造成外部連結斷裂，但基於保險考量，仍加上轉發規則。

## 目標

- 證書頁對外網址從 `/product/:id` 改成 `/identification-report/:id`。
- 分享連結（LINE 等社群平台預覽用）從 `/product/:id/share` 改成 `/identification-report/:id/share`。
- 舊路徑（`/product/:id`、`/product/:id/share`）自動轉發到新路徑，不回應 404。
- **不改**：`ProductDetailView.vue` 檔案本身、route name（`product-detail`）、`detail.*` i18n namespace、後端 API 路徑（`/api/public/inventory/{id}`、`/api/public/inventory/{id}/share`）——這次只動對外可見的前端 URL 路徑，不動內部命名或後端介面。

## 架構決策

### 路由層（`src/router/index.ts`）

- `product-detail` 路由的 `path` 從 `/product/:id` 改成 `/identification-report/:id`；`name`、`component`、`meta` 全部不變。全專案所有透過 `{ name: 'product-detail' }` 連結過去的地方（`IdentificationReportView.vue` 搜尋送出後的 `router.push`、`OrderView.vue` 品項清單、會員中心的訂單明細頁）都是用路由名稱而非硬寫路徑，因此**不需要任何修改**，自動套用新路徑。
- 新增一條轉發路由，緊接在 `product-detail` 路由之後：
  ```ts
  {
    path: '/product/:id',
    redirect: (to) => ({ name: 'product-detail', params: to.params })
  }
  ```
  使用者或搜尋引擎打開舊網址時，Vue Router 會在客戶端直接轉導到新網址（網址列會更新成新路徑）。

### nginx 層（`nginx.conf`）

`/product/:id`（不含 `/share`）本身沒有專屬的 nginx location（走的是預設的 `location /` SPA fallback），所以上面的 Vue Router 轉發就足夠處理，nginx 這邊不需要為它額外加規則。

`/product/:id/share` 則不同——這條路徑目前有專屬的 nginx regex location，攔截後**直接代理到後端**、完全繞過 SPA（LINE 等平台的連結預覽爬蟲不會執行 JS，必須在 nginx 這層就處理掉，Vue Router 的客戶端轉發對它沒有作用）。因此需要：

1. **新增**一條轉發 location，把舊的分享路徑 301 導到新路徑：
   ```nginx
   location ~ ^/product/([^/]+)/share$ {
       return 301 /identification-report/$1/share;
   }
   ```
2. **修改**原本代理到後端的 regex location，比對條件從 `^/product/([^/]+)/share$` 改成 `^/identification-report/([^/]+)/share$`（代理目標 `${API_TARGET_URL}/api/public/inventory/$1/share` 不變）。

兩條 location 需按此順序排列（轉發規則需求值上不影響順序，因為 nginx 是取最長/最精確匹配，但同樣 regex 前綴不會有兩條同時命中的情況，這裡順序純粹是文件可讀性考量）。

### vite dev server（`vite.config.ts`）

比照 `CLAUDE.md` 既有慣例（「這個 proxy rule 也鏡射在 vite.config.ts 的 dev server，改一邊就要改另一邊」），把 `server.proxy` 裡 `'^/product/.+/share$'` 這個 key 連同其 `rewrite` 規則改成比對 `'^/identification-report/.+/share$'`：

```ts
'^/identification-report/.+/share$': {
  target: 'http://localhost:5100',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/identification-report\/(.+)\/share$/, '/api/public/inventory/$1/share'),
}
```

本地開發環境沒有 nginx，所以舊路徑 `/product/:id/share` 在本機不會有轉發效果——這是可接受的落差（本機開發本來就不測試「舊分享連結轉發」這種production-only 的邊角情境），不在本次範圍內另外處理。

## 相依阻塞／假設事項

- **假設**：後端 `GET /api/public/inventory/{id}/share` 回傳的伺服器端渲染 HTML，其內容中用來讓瀏覽器導向前端 SPA 的連結，可能仍然寫死指向舊的 `${FRONTEND_BASE_URL}/product/{id}`（這部分邏輯在後端 repo，前端這邊看不到、也未驗證）。**這不影響本次改動的正確性**——即使後端繼續產生指向 `/product/{id}` 的連結，使用者點擊後仍會先落在前端的 `/product/:id`，被 Vue Router 的轉發規則接住、導到新路徑，體驗上完全無感。不需要因為這次改動而要求後端同步調整。

## 不在此規格範圍

- `ProductDetailView.vue` 檔案改名、route name 改名、`detail.*` i18n namespace 改名——本次僅改對外 URL 路徑。
- 後端 API 路徑或後端產生的分享 HTML 內容——不要求後端配合修改（見上方「假設事項」）。
- 本機開發環境（`vite dev`）對舊分享路徑 `/product/:id/share` 的轉發——僅正式環境（nginx）處理。

## 實作注意事項

1. 修改順序建議：先改 `router/index.ts`（加轉發路由＋改 path），確認 `npm run type-check`／`npm run build` 過；再改 `nginx.conf` 與 `vite.config.ts`（兩者同一個任務內一起改，避免中間狀態不一致）。
2. `nginx.conf` 是樣板檔案，正式環境由容器啟動時的 envsubst 渲染，本地無法直接跑 nginx 驗證語法——檢查方式是目視比對既有 `^/product/([^/]+)/share$` regex location 的寫法，確保新舊兩條 location 的縮排、變數用法（`$1`、`${API_TARGET_URL}`、`${DNS_RESOLVER}`）與既有規則一致。
3. 手動驗證：`npm run dev` 後，瀏覽器打開一個有效商品的舊網址 `/product/{一個真實 UUID}`，確認自動導到 `/identification-report/{同一個 UUID}` 且證書內容正常顯示；`/product/:id/share` 的轉發因需要 nginx，只能在正式環境部署後驗證，本地開發階段無法端對端測試這一段。
