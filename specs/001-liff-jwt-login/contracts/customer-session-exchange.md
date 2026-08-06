# Contract: 客戶授權憑證換發端點

**狀態（2026-08-06 更新）**：後端已實際落地，端點與本文原先的假設不同。以下標記為「~~原假設~~ → 實際」的地方是差異；未特別標記的段落（前端分類邏輯、UI 行為原則）仍然成立，只是套用的欄位/狀態碼換了。前端實作（`src/composables/useCustomerSession.ts`）已依實際規格更新，本文件保留原始假設內容並就地補上差異說明，供之後回顧「原本以為長怎樣」與「後端實際長怎樣」的落差。

## ~~`POST /api/public/customers/session`~~ → 實際為 `POST /api/public/member/login`

依客戶已在 LIFF 內驗證過的 LINE 身分，換發一組後端授權憑證。

### Request

```json
{
  "lineIdToken": "string"
}
```

| 欄位 | 必填 | 說明 |
|---|---|---|
| `lineIdToken` | 是 | `liff.getIDToken()` 取得的 LINE ID Token |

### Response — 200 成功

**實際**：

```json
{
  "success": true,
  "message": "登入成功",
  "data": {
    "accessToken": "string",
    "expiresIn": 1800
  }
}
```

（~~原假設欄位為 `data.token` / `data.expiresInSeconds`，實際回應欄位是 `data.accessToken` / `data.expiresIn`~~。）`expiresIn` 秒數對應 spec FR-005 的 30 分鐘效期，但實際值取決於後端 `CustomerJwtSettings.ExpiryMinutes` 設定，非寫死常數；前端一樣換算為絕對時間存入 `sessionStorage`（見 [data-model.md](../data-model.md#customersession客戶授權工作階段)）。

### Response — 身分類錯誤

**實際**：分成兩個不同的 HTTP status，不是統一的 400：

```json
// 401
{ "success": false, "message": "string", "code": "INVALID_LINE_TOKEN" }

// 403
{ "success": false, "message": "string", "code": "NOT_BOUND" }
```

| HTTP Status | `code` | 觸發情境 | 對應 spec |
|---|---|---|---|
| 401 | `INVALID_LINE_TOKEN` | LINE ID Token 驗證失敗（過期、格式錯誤、簽章不符） | User Story 3 情境 1 |
| 403 | `NOT_BOUND`（~~原假設為 `LINE_NOT_BOUND`~~） | 該 LINE 身分尚未透過既有訂單綁定流程綁定至任何客戶 | FR-007、User Story 3 情境 2 |

### Response — 5xx / 429 / 無回應

伺服器錯誤或逾時，沿用既有 `ApiResponseModel` 的錯誤格式（或直接無回應/連線逾時）。**實際**：`member-login` 端點另外套了 rate limiting，短時間內重試過多次會收到 429。前端一律歸類為「服務類錯誤」（FR-006），不特別解析 body 內容，429 也不例外（見 [research.md §5](../research.md)）。

### 受保護端點的憑證失效（實際規格新增，原文件未涵蓋）

後端有 `CustomerSecurityStampValidationMiddleware`：憑證帶的 `security_stamp` 若跟資料庫目前值不一致（例如客戶密碼被異動），受保護端點會回 401，**即使該憑證的 `expiresIn` 尚未到期**。前端不應把這當成一般錯誤重試，而要清除本地憑證、導向「請重新登入」（`useCustomerSession.ts` 的 `sessionHttp` response interceptor 已處理，歸類為 `identity` 類、`code: 'TOKEN_INVALIDATED'`，此碼為前端自訂，非後端 `ResponseCodes` 的一部分）。另外沒有 refresh token 機制，效期到期後前端必須讓客戶整套重新走一次 LIFF 登入。

### 前端對應行為摘要

| 情境 | 前端分類（見 research.md §5） | UI 行為（FR-006） |
|---|---|---|
| 200 | 成功 | 寫入 `sessionStorage`，不顯示任何訊息（背景無感） |
| 401 `INVALID_LINE_TOKEN` / 403 `NOT_BOUND` | 身分類 | 顯示對應身分類錯誤文案，引導重新登入／補綁定 |
| 受保護端點回應 401（憑證被作廢） | 身分類（`TOKEN_INVALIDATED`） | 清除本地憑證，顯示「請重新登入」 |
| 網路錯誤 / 408 / 429 / 5xx / 其他非預期狀態碼 | 服務類 | 顯示「服務暫時無法使用」+ 重試按鈕 |
