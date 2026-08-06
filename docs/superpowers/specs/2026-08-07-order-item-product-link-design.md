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
- 商品名稱區塊（原本的 `brand` + `style` 文字）：
  - `inventoryItemId` 有值 → 包一層 `<router-link :to="{ name: 'product-detail', params: { id: orderItem.inventoryItemId } }">`，導到既有的 `/product/:id` 路由（`ProductDetailView.vue`，本來就是給 UUID 查鑑定證書用的頁面，見 `src/router/index.ts`）。文字加底線提示可點擊。
  - `inventoryItemId` 是 `null` → 維持原本純文字顯示，不做連結，避免連到一個註定 404 的頁面。
- 沒有新增額外的 API 呼叫——鑑定頁面本來就是靠 `ProductDetailView.vue` 掛載後自己打 `GET /api/public/inventory/{id}` 抓資料，這裡只是提供正確的 UUID 讓路由導過去。
- 用 `<router-link>` 而非 `@click` + `router.push()`：保留原生 `<a>` 語意（可以 ctrl/cmd+click 開新分頁、可以看到目標網址），跟專案裡其他導覽連結一致。

## 4. 不在此規格範圍內

- 品項縮圖（`imageUrl`）與金額（`amount`）目前不是連結的一部分，維持原本純顯示——使用者的需求明確是「商品名稱」，沒有要求整個項目卡片可點擊。
- LIFF 內嵌瀏覽器的分頁行為（`<router-link>` 預設同分頁導覽，SPA 內部路由切換，不會離開 LIFF webview）——沒有額外處理，沿用 Vue Router 預設行為。
