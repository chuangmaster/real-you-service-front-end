# Spec: 訂單項目商品名稱連到鑑定頁面

- **Date**: 2026-08-07
- **Topic**: Order Item → Product Detail Link

## 1. 問題

`OrderView.vue`「訂單項目」清單（`summary.items`）目前只是純文字顯示 `orderItem.brand` / `orderItem.style`，使用者想從訂單頁直接點進該商品的鑑定證書頁面（`/product/:id`，即 `ProductDetailView.vue`），但原本的 `PublicOrderItemResult` 回應完全沒有商品 UUID，前端拿不到可以連過去的目標。

## 2. 後端變更（已完成，非本次範圍）

後端在共用的 `PublicOrderItemResult`（`GET /api/public/orders/view` 的 `data.items[]`，以及 `GET /api/public/orders/sales/{id}` 的 `data.items[]` 共用同一個 schema）新增 `inventoryItemId`（nullable uuid）欄位：

```json
{
  "inventoryItemId": "30bd1e1f-5923-4091-9661-325309dcaeb8",
  "brand": "Chanel (香奈兒)",
  "style": "測試備註",
  "imageUrl": "https://...",
  "amount": 66666.00
}
```

`nullable`：部分品項（例如服務單，沒有對應 inventory 紀錄）可能沒有這個 id，前端要能處理 `null` 的情況。

## 3. 前端變更

`src/views/OrderView.vue`：

- `OrderItem` 介面新增 `inventoryItemId: string | null`。
- 品項列（縮圖＋商品名稱＋金額整列）：
  - `inventoryItemId` 有值 → 整列包一層 `<router-link :to="{ name: 'product-detail', params: { id: orderItem.inventoryItemId } }">`，導到既有的 `/product/:id` 路由（`ProductDetailView.vue`，本來就是給 UUID 查鑑定證書用的頁面，見 `src/router/index.ts`）。
  - `inventoryItemId` 是 `null` → 維持原本純文字顯示（`<div>` 而非 `<router-link>`），不做連結，避免連到一個註定 404 的頁面。
- 沒有新增額外的 API 呼叫——鑑定頁面本來就是靠 `ProductDetailView.vue` 掛載後自己打 `GET /api/public/inventory/{id}` 抓資料，這裡只是提供正確的 UUID 讓路由導過去。
- 用 `<router-link>` 而非 `@click` + `router.push()`：保留原生 `<a>` 語意（可以 ctrl/cmd+click 開新分頁、可以看到目標網址），跟專案裡其他導覽連結一致。

### 3.1 後續調整（2026-08-07）：加強可點擊的視覺提示

第一版只把商品名稱文字加底線標示可點擊，實際使用後回饋「感覺只是用標題還不夠直覺」——底線在手機瀏覽器上不夠醒目，熱區也偏小（只有文字本身）。改為整列可點擊 + 右側 `chevron_right` 圖示的清單列樣式（比較兩三個方向後選定，見對話紀錄）：

- 整列（縮圖、品名、金額）都包進 `<router-link>` / `<div>`，不再只有文字區塊可點。
- 移除文字底線，改在列尾加 `chevron_right`（Material Symbols）圖示，是行動裝置清單「可點進下一頁」最常見的視覺語彙。
- `hover:bg-surface-container active:bg-surface-container`：整列背景在互動時變深一階，取代原本文字的 `hover:opacity-70`。
- 兩個分支（有 / 沒有 `inventoryItemId`）的內部 markup 特意保持一致（除了外層標籤與 chevron），純粹只是「這一列能不能點」的差異，沒有 id 的品項看起來就是少了 chevron 圖示、背景不會有 hover 效果。

## 4. 不在此規格範圍內

- LIFF 內嵌瀏覽器的分頁行為（`<router-link>` 預設同分頁導覽，SPA 內部路由切換，不會離開 LIFF webview）——沒有額外處理，沿用 Vue Router 預設行為。
