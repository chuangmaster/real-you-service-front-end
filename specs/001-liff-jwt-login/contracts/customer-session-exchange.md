# Contract: 客戶授權憑證換發端點

**狀態**：本端點目前尚未存在於後端（`real-you-back-end`）。以下契約是前端依照現有 `PublicApi` 慣例（`ApiResponseModel`、`ResponseCodes`）**假設**出來的期望介面，供前端開發時對接的目標；實際後端實作需另行規劃、不在本 repo 範圍內。若後端最終落地的契約與此不同，僅需調整前端 composable 內的請求/回應對應，不影響其餘設計（見 [research.md §1](../research.md#1-換發端點的請求回應契約)）。

## `POST /api/public/customers/session`

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

```json
{
  "success": true,
  "message": "換發成功",
  "data": {
    "token": "string",
    "expiresInSeconds": 1800
  }
}
```

`expiresInSeconds` 固定為 1800（30 分鐘，對應 spec FR-005）；前端收到後換算為絕對時間存入 `sessionStorage`（見 [data-model.md](../data-model.md#customersession客戶授權工作階段)）。

### Response — 400 身分類錯誤

```json
{
  "success": false,
  "message": "string",
  "code": "INVALID_LINE_TOKEN | LINE_NOT_BOUND"
}
```

| `code` | 觸發情境 | 對應 spec |
|---|---|---|
| `INVALID_LINE_TOKEN` | LINE ID Token 驗證失敗（過期、格式錯誤、簽章不符） | User Story 3 情境 1 |
| `LINE_NOT_BOUND`（新增） | 該 LINE 身分尚未透過既有訂單綁定流程綁定至任何客戶 | FR-007、User Story 3 情境 2 |

### Response — 5xx / 無回應

伺服器錯誤或逾時，沿用既有 `ApiResponseModel` 的錯誤格式（或直接無回應/連線逾時）。前端一律歸類為「服務類錯誤」（FR-006），不特別解析 body 內容。

### 前端對應行為摘要

| 情境 | 前端分類（見 research.md §5） | UI 行為（FR-006） |
|---|---|---|
| 200 | 成功 | 寫入 `sessionStorage`，不顯示任何訊息（背景無感） |
| 400 `INVALID_LINE_TOKEN` / `LINE_NOT_BOUND` | 身分類 | 顯示對應身分類錯誤文案，引導重新登入／補綁定 |
| 網路錯誤 / 408 / 5xx / 其他非預期狀態碼 | 服務類 | 顯示「服務暫時無法使用」+ 重試按鈕 |
