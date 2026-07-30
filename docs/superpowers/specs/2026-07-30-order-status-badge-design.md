# Spec: 訂單狀態多語系徽章（Order Status Badge）

- **Date**: 2026-07-30
- **Topic**: Order Status Badge

## 1. 問題

`OrderView.vue` 的訂單摘要卡片目前直接把後端回傳的 `summary.status` 原始字串（`PENDING` / `COMPLETED` / `CANCELLED`）印出來（`src/views/OrderView.vue:259`），既沒有多語系翻譯，也沒有任何視覺樣式，跟頁面其他欄位比起來顯得突兀。

## 2. 需求

把訂單狀態改成有多語系翻譯、有顏色區分的徽章（badge）：

| API 值 | English | 繁中 |
|---|---|---|
| `PENDING` | Processing | 處理中 |
| `COMPLETED` | Completed | 已完成 |
| `CANCELLED` | Cancelled | 已取消 |

## 3. 視覺設計

沿用 `ProductDetailView.vue` 既有的「AUTHENTIC」徽章樣式（`src/views/ProductDetailView.vue:399-401`）：膠囊形狀、`bg-{color}/10` + `border-{color}/20` 的淡色底、`text-{color}` 文字，`font-label-caps text-sm uppercase`。三種狀態各自對應到專案既有的語意色，不新增任何新顏色：

- `PENDING` → `primary`（品牌金色，代表進行中）
- `COMPLETED` → `authentic-emerald`（沿用鑑定通過徽章的綠色，語意上都是「完成/沒問題」）
- `CANCELLED` → `error`（既有的紅色語意色）
- 非上述三種的未知字串（防呆）→ `secondary`（灰色），直接顯示原始字串，不阻斷畫面

## 4. 元件設計

新增可重用元件 `src/components/OrderStatusBadge.vue`：

- Props：`status: string`（原始 API 值）
- 內部用一個 `Record<string, { labelKey: string; colorClass: string }>` 對照表做映射；查無對應時 fallback 成 `secondary` 色 + 直接顯示原始 `status` 字串（不查 i18n key，避免顯示 `[Object object]` 或 raw i18n key 字串）
- 顏色透過 class 字串直接映射（Tailwind 需要完整的類別名稱才能在建置時被掃到，不能用字串拼接動態組出 `bg-${color}/10`）
- i18n key 使用時走 `$t()`，兩個 locale 都要補齊

## 5. i18n 變更

在 `src/i18n.ts` 的 `order` 區塊下新增 `status` 子物件：

```
order.status.pending / .completed / .cancelled
```

- `en`: Processing / Completed / Cancelled
- `zh-TW`: 處理中 / 已完成 / 已取消

## 6. 套用範圍

僅替換 `OrderView.vue` 摘要卡片中的狀態欄位：

```html
<OrderStatusBadge :status="summary.status" />
```

取代原本的 `{{ summary.status }}`（`src/views/OrderView.vue:259`）。其餘欄位排版不變。元件本身以獨立檔案存在，之後若其他頁面（例如商品頁）需要顯示訂單狀態，可直接匯入重用。

## 7. 驗證方式

- 手動在 `npm run dev` 起的 `/order?t=...` 頁面，用假資料或攔截 API response 分別測試三種狀態值 + 一個未知字串，確認徽章顏色、文字、多語系切換（頁面右上角的語言切換按鈕）都正確。
- 無自動化測試（專案本身沒有測試套件，比照現況）。
