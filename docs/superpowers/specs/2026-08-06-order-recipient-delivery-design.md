# 訂單收件資訊顯示與編輯設計

## 背景

`src/views/OrderView.vue`（見 [[2026-07-23-liff-order-view-design]]、[[2026-07-25-order-auto-bind-design]]）目前透過分享連結 `t` token 呼叫 `GET /api/public/orders/view` 顯示訂單摘要，回應的 `PublicOrderSummaryResult` 不含收件（配送）相關欄位。

後端 `http://localhost:5100/swagger/v1/swagger.json` 另外提供了已登入會員專用的訂單明細與收件資訊修改端點：

- `GET /api/public/orders/sales/{id}` — 查詢目前登入會員自己的銷售訂單明細，含 `deliveryMethod`、`deliveryInfo`、`orderStatus`、`shippingStatus`、樂觀鎖 `version`。
- `PATCH /api/public/orders/sales/{id}/delivery` — 修改目前登入會員自己的銷售訂單收件方式與收件資訊。

服務單（收購/寄賣，`GET /api/public/orders/service/{id}` 對應的 `CustomerServiceOrderDetailResult`）完全沒有 `deliveryMethod`/`deliveryInfo` 欄位，本次功能不涉及服務單。

本次目標：在既有訂單頁面上，於使用者登入並完成 LINE 綁定後，額外顯示該訂單的收件資訊；若訂單狀態符合可編輯條件，允許使用者直接在頁面上修改收件方式與收件資訊。

## API 對應總覽

| 用途 | Method | Path | 認證 | 備註 |
|---|---|---|---|---|
| 訂單摘要（既有，不變） | GET | `/api/public/orders/view?t=` | 分享 token，無需登入 | 回傳 `PublicOrderSummaryResult`，含 `orderId`、`orderKind`、`isBound` |
| 銷售訂單明細（新增） | GET | `/api/public/orders/sales/{id}` | 需 `sessionHttp`（客戶 JWT） | 回傳 `CustomerSalesOrderDetailResult`，含 `deliveryMethod`、`deliveryInfo`、`orderStatus`、`shippingStatus`、`version` |
| 修改收件資訊（新增） | PATCH | `/api/public/orders/sales/{id}/delivery` | 需 `sessionHttp`（客戶 JWT） | body 為 `UpdateOrderDeliveryRequest`，回傳 `UpdateOrderDeliveryResponse` |

`sessionHttp` 是 `src/composables/useCustomerSession.ts` 已存在但目前尚無任何頁面使用的授權 axios instance（request interceptor 自動帶 `Authorization: Bearer <token>`），本次功能是它的第一個使用場景。

## 使用者流程

```mermaid
sequenceDiagram
    participant Customer as 客戶
    participant FE as OrderView.vue
    participant API as V3.Public.Api

    Customer->>FE: 開啟 {BaseUrl}/order?t=xxx
    FE->>API: GET /api/public/orders/view?t=xxx
    API-->>FE: summary（含 orderId, orderKind, isBound）
    FE-->>Customer: 顯示訂單摘要（既有行為不變）

    FE->>FE: ensureSession() + attemptAutoBind()（既有行為不變）

    FE->>FE: maybeFetchDeliveryDetail()
    alt orderKind !== 'Sales'
        FE-->>Customer: 不顯示收件資訊區塊（服務單）
    else isBound === false 或 sessionReady === false
        FE-->>Customer: 不顯示收件資訊區塊（尚未登入綁定）
    else 條件滿足
        FE->>API: GET /api/public/orders/sales/{orderId}（sessionHttp）
        alt 成功
            API-->>FE: deliveryMethod, deliveryInfo, orderStatus, shippingStatus, version
            FE-->>Customer: 顯示「收件資訊」區塊（唯讀）
            alt orderStatus === 'PLACED' 且 shippingStatus !== 'SHIPPED'
                FE-->>Customer: 顯示「編輯」按鈕
            end
        else 403 / 404 / 500
            FE-->>Customer: 不顯示收件資訊區塊（console.error 記錄，靜默失敗）
        end
    end

    Customer->>FE: 點擊「編輯」
    FE-->>Customer: 區塊原地切換成表單（收件方式三選一 + 對應欄位）
    Customer->>FE: 修改欄位後點擊「儲存」
    FE->>API: PATCH /api/public/orders/sales/{orderId}/delivery（deliveryMethod, deliveryInfo, version）
    alt 200
        API-->>FE: 最新 deliveryMethod, deliveryInfo, version
        FE-->>Customer: 更新畫面、退出編輯模式
    else 409 VERSION_CONFLICT
        FE->>API: 重新 GET sales/{orderId}
        API-->>FE: 最新資料
        FE-->>Customer: 提示「資料已被更新，請重新確認後再提交」，表單改填最新值，停留編輯模式
    else 422 ORDER_NOT_EDITABLE
        FE->>API: 重新 GET sales/{orderId}
        FE-->>Customer: 提示「此訂單目前狀態已無法修改收件資訊」，退出編輯模式並更新唯讀畫面
    else 422 INVALID_DELIVERY_INFO
        FE-->>Customer: 提示「請確認收件資訊填寫完整」，停留編輯模式
    else 400 / 403 / 404 / 500
        FE-->>Customer: 提示「發生錯誤，請稍候再試」，停留編輯模式
    end
```

## 架構決策

### OrderKind 判斷

`OrderKind` 為字串 enum（`"Service" | "Sales"`，非數字）。收件資訊區塊僅在 `summary.orderKind === 'Sales'` 時才進入後續流程；`'Service'` 完全不呼叫任何收件相關 API、不顯示任何收件 UI。

### 資料抓取時機

新增 `maybeFetchDeliveryDetail()`，條件為 `summary.orderKind === 'Sales' && summary.isBound === true && sessionReady === true`。呼叫時機（三處）：

1. `onMounted` 內，`Promise.all([fetchOrderSummary(), ensureSession()])` 完成後（比照既有 `attemptAutoBind()` 的呼叫位置）。
2. `handleBind()` 成功、`summary.isBound` 變為 `true` 之後。
3. `attemptAutoBind()` 成功、`summary.isBound` 變為 `true` 之後。

`GET /api/public/orders/sales/{orderId}` 呼叫失敗（403 / 404 / 500）時比照現有 auto-bind 靜默失敗慣例：僅 `console.error` 記錄，不顯示任何錯誤文字，收件資訊區塊單純不出現——不影響訂單摘要本身的顯示。

### 新增型別

```ts
type OrderKind = 'Service' | 'Sales'
type DeliveryMethod = 'HOME_DELIVERY' | 'STORE_PICKUP' | 'PICKUP'

interface HomeDeliveryInfo {
  recipientName: string
  recipientPhone: string
  recipientAddress: string
}
interface StorePickupInfo {
  storeInfo: string
  recipientName: string
  recipientPhone: string
}
interface PickupInfo {
  location: string
  pickupTime?: string | null
}

interface SalesOrderDeliveryDetail {
  orderStatus: string
  shippingStatus: string
  deliveryMethod: DeliveryMethod | null
  deliveryInfo: HomeDeliveryInfo | StorePickupInfo | PickupInfo | null
  version: number
}
```

`deliveryInfo` 三種形狀依 `deliveryMethod` 對應（來源：後端 `Core/Models/Dtos/CustomerDeliveryInfoDtos.cs`）。命名容易搞混：`PICKUP` = 門市自取、`STORE_PICKUP` = 超商取貨，實作時需特別留意對應關係，避免寫反。

### 新元件：`src/components/OrderRecipientSection.vue`

拆成獨立元件而非直接塞進 `OrderView.vue`（目前已 330+ 行）。

- **Props**：`detail: SalesOrderDeliveryDetail`、`orderId: string`
- **Emits**：`updated`，帶更新後的 `SalesOrderDeliveryDetail`，供 `OrderView.vue` 更新本地狀態
- 內部使用 `sessionHttp`（直接 import，比照 `OrderView.vue` 既有「axios 直接呼叫在元件內、不另建 service 層」的慣例，見 [[2026-07-23-liff-order-view-design]]）
- 元件內部自行管理「唯讀 / 編輯中」兩種顯示模式，透過 local `ref` 切換，不使用 modal

#### 唯讀模式

卡片樣式比照現有訂單摘要卡片（`bg-white border border-outline-variant/30 shadow-sm`）。顯示：

- 收件方式中文名稱（`HOME_DELIVERY`→宅配／`STORE_PICKUP`→超商取貨／`PICKUP`→門市自取）
- 依方式顯示對應欄位內容（唯讀文字）
- 若 `orderStatus === 'PLACED' && shippingStatus !== 'SHIPPED'`，卡片右上角顯示「編輯」按鈕；否則不顯示編輯入口，也不額外顯示「不可編輯」提示文字（唯讀呈現本身就是狀態）

#### 編輯模式

點擊「編輯」後，同一區塊原地切換成表單：

- 最上方為收件方式三選一（radio 或 select），**允許使用者切換收件方式**；切換後下方欄位跟著換成對應方式的欄位，並清空欄位內容（不嘗試在不同方式間映射欄位值）
- 三種方式底下皆為純文字 `<input type="text">`：
  - `HOME_DELIVERY`：收件人姓名、收件人電話、收件地址（皆必填）
  - `STORE_PICKUP`：超商門市資訊、收件人姓名、收件人電話（皆必填）
  - `PICKUP`：取貨地點（必填）
- `PickupInfo.pickupTime` **v1 不放入表單**：若原始 `deliveryInfo` 含 `pickupTime`，送出時原樣帶回、不覆蓋為 `null`；若使用者切換到 `PICKUP` 以外的方式又切回來，`pickupTime` 視同遺失（不特別處理，因為此時使用者本來就在重新編輯收件方式，屬於合理行為）
- 前端送出前對必填欄位做 `trim()` 後非空驗證，未通過就地顯示提示文字、不送出請求（對應後端 `INVALID_DELIVERY_INFO` 驗證邏輯提前擋掉明顯錯誤，非重複實作完整驗證規則）
- 底部「儲存」「取消」按鈕；「取消」直接丟棄表單內容、退回唯讀模式顯示原資料；儲存中兩按鈕皆 disable，「儲存」文字改為 loading 文案（比照現有 `handleBind` 的 `binding` 狀態模式）

### 送出與錯誤處理

`PATCH /api/public/orders/sales/{orderId}/delivery`，body：`{ deliveryMethod, deliveryInfo, version: detail.version }`。

| 情況 | code | 處理 |
|---|---|---|
| 成功 | 200 | 用回應的 `UpdateOrderDeliveryResponse` 更新本地 `detail`（含新 `version`），退出編輯模式 |
| 樂觀鎖衝突 | 409 `VERSION_CONFLICT` | 提示「資料已被更新，請重新確認後再提交」；自動重新 `GET /api/public/orders/sales/{orderId}` 取得最新 `deliveryMethod`/`deliveryInfo`/`version`，覆蓋表單目前顯示值；**不自動重送**，停留編輯模式待使用者確認後再次按「儲存」 |
| 狀態已不可編輯 | 422 `ORDER_NOT_EDITABLE` | 提示「此訂單目前狀態已無法修改收件資訊」；重新 `GET` 一次更新 `orderStatus`/`shippingStatus`，退出編輯模式回到唯讀顯示（此時唯讀畫面的「編輯」按鈕也會因狀態更新而自動消失） |
| 欄位驗證失敗 | 422 `INVALID_DELIVERY_INFO` | 提示「請確認收件資訊填寫完整」，停留編輯模式讓使用者修正 |
| 其他 | 400（無 code，`ValidationProblemDetails`）／403 `FORBIDDEN`／404 `NOT_FOUND`／500 `INTERNAL_ERROR` | 統一顯示通用訊息「發生錯誤，請稍候再試」，停留編輯模式（這幾種在「已成功載入明細才進入編輯」的前提下都屬異常邊界情況，沒有需要區分文案的必要） |

400 的回應是 ASP.NET Core 預設 `ValidationProblemDetails`（`application/problem+json`），格式與其他錯誤（含 `success`/`code`/`traceId` 的自訂 `ApiResponseModel`）不同，錯誤處理程式碼不能假設所有非 200 回應都長一樣的形狀——判斷順序應先看 HTTP status，再視情況讀取 `code`，而非直接假設 body 一定有 `code` 欄位。

### i18n

`src/i18n.ts` 新增 `order.recipient.*`（`en`、`zh-TW` 皆須新增，沿用現有扁平巢狀物件慣例）：

- `title`
- `methods.HOME_DELIVERY` / `methods.STORE_PICKUP` / `methods.PICKUP`
- `fields.recipientName` / `fields.recipientPhone` / `fields.recipientAddress` / `fields.storeInfo` / `fields.location`
- `editButton` / `saveButton` / `cancelButton` / `saving`
- `errors.versionConflict` / `errors.notEditable` / `errors.invalidInfo` / `errors.generic`
- `validation.required`

## 測試/驗證方式

專案無測試框架與 lint（見 CLAUDE.md），依現有慣例驗證：

1. `npm run type-check`（`vue-tsc --noEmit`）
2. `npm run build`
3. `npm run dev` 手動瀏覽器測試，需準備三種後端測試資料：
   - 狀態 `PLACED` 且已綁定 LINE 的銷售訂單 → 應顯示收件資訊 + 可編輯，含切換收件方式、409 衝突、422 兩種驗證錯誤的模擬
   - 非 `PLACED` 或 `shippingStatus === 'SHIPPED'` 的銷售訂單 → 應顯示收件資訊但無編輯按鈕
   - 服務單（`orderKind === 'Service'`） → 完全不顯示收件資訊區塊

## 後續調整（2026-08-06）

實際使用時發現：PATCH 成功（200）後直接信任回應 body 拼出畫面顯示的 `detail`，遇到回應內容與伺服器實際落地結果不一致的情況（例如 `deliveryInfo` 某個欄位在回應裡是舊值/空值）時，畫面會顯示錯誤的資訊，使用者得手動重新整理整個頁面才會看到正確內容——這對一個 SPA 來說不是使用者該承擔的成本。

因此把成功分支也改成呼叫既有的 `refetchDetail()`（重新 `GET /api/public/orders/sales/{orderId}`），跟 409 `VERSION_CONFLICT` 分支使用同一套「不信任回應 body、以重新 GET 的結果為準」邏輯，不再直接用 `UpdateOrderDeliveryResponse` 拼本地 `detail`。多付出的成本是每次儲存成功都多一次 GET 請求，換來的是畫面永遠反映伺服器當下真正的資料，不需要使用者自行重新整理頁面。

## 不在此規格範圍內

- 服務單（收購/寄賣）收件資訊——後端資料模型本身不支援，非本次範圍。
- `PickupInfo.pickupTime` 的編輯 UI——v1 明確排除，日期時間欄位留待後續需求評估。
- 收件資訊的伺服端完整驗證規則重建——前端僅做必填非空的提前擋錯，實際驗證邏輯以後端 `CustomerOrderDeliveryService.IsDeliveryInfoValid` 為準。
- `sessionHttp` 授權失效（如 JWT 過期）時的重新登入導轉——沿用 [[2026-07-23-liff-order-view-design]] 既有的 `exchangeError` 處理機制，本次不新增額外邏輯。
