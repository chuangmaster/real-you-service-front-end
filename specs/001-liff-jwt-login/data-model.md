# Phase 1 資料模型：LIFF 登入取得後端 JWT 授權

本功能是純前端實作，沒有資料庫層；這裡描述的是**前端記憶體/`sessionStorage` 中的客戶端狀態模型**，對應 spec 的 Key Entities 章節。後端持久化的客戶/綁定資料模型不在本 repo 範圍內。

## CustomerSession（客戶授權工作階段）

前端持有的授權狀態，換發成功後寫入 `sessionStorage`，過期或分頁關閉後失效。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `token` | `string` | 後端核發的授權憑證（JWT），用於後續請求的 `Authorization: Bearer` header |
| `expiresAt` | `string`（ISO 8601） | 絕對過期時間；由 `exchangedAt + 30 分鐘`（FR-005）換算後存入，避免每次讀取都要重新計算相對時間 |

**驗證規則**：
- 讀取時若 `expiresAt` 已早於目前時間，視為無效，等同沒有 session（FR-005 觸發重新換發）。
- 寫入時機：僅在 `POST /api/public/customers/session` 成功回應後寫入；換發失敗不寫入、不清除既有有效 session（避免用一次暫時性的服務錯誤清掉客戶手上還有效的憑證）。

**生命週期**：

```text
[不存在]
   │ 換發成功 (FR-001)
   ▼
[有效] ──過期 (30 分鐘, FR-005)──▶ [已過期，視同不存在]
   │                                      │
   │ 分頁/工作階段結束 (FR-004)             │ 下次需要時自動重新換發（無感，FR-005）
   ▼                                      ▼
[不存在]                              [有效]（新一輪）
```

## LineIdentityCredential（LINE 身分憑證，換發用的輸入）

不落地儲存，僅在換發當下即時向 `@line/liff` SDK 取得、隨即用於 API 呼叫後即捨棄。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `lineIdToken` | `string` | `liff.getIDToken()` 回傳值，換發請求的唯一輸入 |

## ExchangeError（換發失敗結果，FR-006 分類用）

不落地儲存，僅存在於單次換發嘗試的記憶體狀態中，供頁面決定要顯示哪一種錯誤 UI。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `kind` | `'identity' \| 'service'` | 依 [research.md §5](./research.md#5-換發失敗的分類判斷邏輯對應-fr-006) 的規則分類 |
| `code` | `string \| undefined` | 身分類錯誤時，後端回傳的 `ResponseCodes`（如 `INVALID_LINE_TOKEN`、`LINE_NOT_BOUND`），供文案對應 |

## 與現有後端資料模型的關係（脈絡說明，非本 repo 實作範圍）

`CustomerSession` 換發時，後端需要能把 `lineIdToken` 解析出的 LINE 使用者 ID，對應到既有的 `Customer` 實體（`Models/Entities/Customer.cs`）與其既有的 LINE 綁定關係（`ICustomerLineBindingService`）。前端不需要知道這層對應的實作細節，只需要知道：換發成功即代表「這個 LINE 身分背後有一個明確的客戶」（FR-007），換發失敗的 `LINE_NOT_BOUND` 則代表這層對應不存在。
