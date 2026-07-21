# 配件顯示串接真實 API 資料 — 設計文件

日期：2026-07-21

## 背景

`ProductDetailView.vue` 的「隨附配件」區塊（`accessories` computed，第 143–157 行）目前是完全寫死的假資料：無論查詢哪一個商品 UUID，畫面上顯示的 13 種配件與「是否隨附」狀態都一模一樣。程式碼註解寫著「mock metadata since not provided by standard public API」，`InventoryItem` interface 也確實沒有任何配件相關欄位。

後端 `/api/public/inventory/{id}` 現已新增 `accessories` 欄位，回傳一個字串陣列，內容為「該商品實際隨附」的配件代碼；未列出的代碼視為沒有隨附。代碼為 camelCase，與現有 i18n key（`detail.accList.*`）完全一致：

| 代碼 | 對應 i18n key |
|---|---|
| `box` | box（盒子） |
| `dustBag` | dustBag（防塵袋） |
| `purchaseProof` | purchaseProof（購證） |
| `shoppingBag` | shoppingBag（提袋） |
| `shoulderStrap` | shoulderStrap（肩帶） |
| `felt` | felt（羊毛氈） |
| `pillow` | pillow（枕頭） |
| `card` | card（保卡） |
| `lockKey` | lockKey（鎖頭/鑰匙） |
| `ribbon` | ribbon（緞帶/花） |
| `brandCard` | brandCard（品牌小卡） |
| `certificate` | certificate（保證書） |
| `raincoat` | raincoat（雨衣） |

另有一個特殊值 `none`，表示該商品明確沒有任何隨附配件。

## 目標

- 配件顯示改為讀取 API 的真實資料，反映每個商品實際的配件狀態。
- 不改變現有 UI 呈現方式（13 格固定版位、淡化樣式）。

## 非目標

- 不處理後端資料結構之外的擴充（例如配件數量、配件照片等）。
- 不新增測試框架或 lint（專案目前沒有配置）。

## 設計

### 資料模型

`InventoryItem` interface（`src/views/ProductDetailView.vue` 第 19–26 行）新增欄位：

```ts
interface InventoryItem {
  id?: string
  inventoryNumber?: string
  brandName?: string
  styleName?: string
  serialId?: string
  images?: InventoryImage[]
  accessories?: string[]
}
```

### 元件邏輯

因為後端代碼與 i18n key 完全一致，不需要額外的代碼對照表，只需把 icon 跟 key 綁在一起，並依 `owned.includes(key)` 判斷是否隨附：

```ts
const ACCESSORY_KEYS = [
  { key: 'box', icon: 'inventory_2' },
  { key: 'dustBag', icon: 'shopping_bag' },
  { key: 'purchaseProof', icon: 'receipt_long' },
  { key: 'shoppingBag', icon: 'shopping_cart' },
  { key: 'shoulderStrap', icon: 'link' },
  { key: 'felt', icon: 'texture' },
  { key: 'pillow', icon: 'chair' },
  { key: 'card', icon: 'credit_card' },
  { key: 'lockKey', icon: 'lock' },
  { key: 'ribbon', icon: 'bookmark' },
  { key: 'brandCard', icon: 'badge' },
  { key: 'certificate', icon: 'verified_user' },
  { key: 'raincoat', icon: 'umbrella' }
]

const accessories = computed(() => {
  const owned = item.value?.accessories ?? []
  return ACCESSORY_KEYS.map(({ key, icon }) => ({
    name: t(`detail.accList.${key}`),
    icon,
    present: owned.includes(key)
  }))
})
```

移除原本「mock metadata since not provided by standard public API」的註解，因為資料來源已經是真實 API。

### 邊界情況

- `accessories` 為 `undefined`／`null`：`owned` 退回空陣列，13 項全部顯示未隨附（淡化樣式），與現有視覺一致，不需額外狀態。
- `accessories` 含 `"none"` 或任何未知字串：因為不在 `ACCESSORY_KEYS` 清單裡，`includes()` 自然比對不到，效果等同「全部未隨附」，不需要特殊分支處理。
- 顯示順序固定沿用現有的 13 項前端順序，不受 API 陣列順序影響。

### 本機開發環境 port 變更

後端本機開發 port 由 5176 改為 5000，需同步修改：

- `vite.config.ts` 第 10、14 行的 proxy target：`http://localhost:5176` → `http://localhost:5000`
- `CLAUDE.md` 中提到「reachable locally at `http://localhost:5176`」的段落，同步改為 5000

## 測試計畫

專案沒有自動化測試框架與 lint，以下皆為手動驗證（`npm run dev`，搭配本機後端 `http://localhost:5000`）：

1. 查詢一個 `accessories` 含部分代碼的商品（例如 `["box", "card", "certificate"]`），確認對應 3 格亮起、其餘 10 格淡化。
2. 查詢一個 `accessories: ["none"]` 的商品，確認 13 格全部淡化。
3. 查詢一個 `accessories` 欄位缺失（`undefined`）的商品，確認 13 格全部淡化，畫面不報錯。
4. 切換 `zh-TW` / `en` 語系，確認配件標籤文字仍正確對應。
5. 確認 `vite.config.ts` 改用 5000 後，`/api` 與 `/product/{id}/share` 兩條 proxy 規則都能正常打到本機後端。
