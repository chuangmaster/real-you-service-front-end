# Quickstart：驗證 LIFF 登入取得後端 JWT 授權

本功能沒有自動化測試（見 [plan.md](./plan.md) Technical Context 的 Testing 說明），以下是端到端手動驗證步驟。

## 前置條件

- 後端 `POST /api/public/customers/session` 端點已依 [contracts/customer-session-exchange.md](./contracts/customer-session-exchange.md) 上線（本機開發時指向 `http://localhost:5100`，見 `vite.config.ts` 的 `/api` proxy）。
- 已在本機 `.env` 設定 `VITE_LIFF_ID`（沿用 `OrderView.vue` 既有設定，見 [2026-07-23-liff-order-view-design.md](../../docs/superpowers/specs/2026-07-23-liff-order-view-design.md)）。
- 測試用的 LINE 帳號，且該帳號已透過既有訂單分享連結完成過一次訂單綁定（滿足 FR-007 的前提）。
- 透過 VS Code dev tunnel 或 ngrok 取得 HTTPS 網址（LIFF 要求 HTTPS），比照 `vite.config.ts` 的 `allowedHosts` 設定。

## 情境 1：已登入 LINE 且已綁定 → 背景無感換發（User Story 1, SC-001）

1. 用測試 LINE 帳號、透過 LIFF 開啟 `/order?t={有效的分享連結 token}`。
2. 開啟瀏覽器開發者工具的 Network 面板，觀察 `POST /api/public/customers/session` 請求。
3. **預期結果**：頁面載入後 3 秒內該請求完成且回應 200；`sessionStorage` 出現對應的 `token`/`expiresAt`；頁面上不出現任何登入或綁定按鈕（因為已綁定），也沒有任何提示訊息。

## 情境 2：尚未登入 LINE → 頁面決定 UI，不強制導頁（User Story 1 情境 2, FR-002）

1. 在無痕視窗（或先登出 LINE）狀態下開啟同一個 `/order?t=...` 連結。
2. **預期結果**：頁面正常顯示訂單摘要，**不會自動跳轉去 LINE 登入頁**；畫面上出現既有的「登入/綁定」按鈕。
3. 點擊按鈕，確認才觸發 `liff.login()` 導轉；登入完成導回頁面後，確認 `POST /api/public/customers/session` 自動接續發出，不需要再點第二次按鈕。

## 情境 3：已換發，重新整理頁面 → 沿用既有憑證（User Story 2, SC-003）

1. 完成情境 1 後，直接重新整理頁面。
2. 觀察 Network 面板。
3. **預期結果**：`sessionStorage` 中的憑證未過期時，不會再送出新的 `POST /api/public/customers/session` 請求（或即使送出也是背景無感，客戶不會看到任何登入畫面）。

## 情境 4：授權憑證過期 → 自動無感重新換發（User Story 2 情境 2, FR-005）

1. 完成情境 1 後，於瀏覽器開發者工具手動修改 `sessionStorage` 中該筆資料的 `expiresAt` 為過去時間（模擬 30 分鐘後）。
2. 觸發任一個需要授權的動作（或重新整理頁面）。
3. **預期結果**：偵測到憑證已過期後，自動重新呼叫換發端點，取得新憑證，客戶不會被要求重新登入（因為 LINE 登入狀態仍然有效）。

## 情境 5：LINE 身分驗證失敗 → 身分類錯誤文案（User Story 3 情境 1, FR-006）

1. 透過開發者工具攔截並竄改換發請求的 `lineIdToken`（或使用已知會導致後端回傳 `INVALID_LINE_TOKEN` 的測試帳號）。
2. **預期結果**：畫面顯示身分類錯誤訊息，**不出現**「重試」按鈕（見 [contracts/customer-session-exchange.md](./contracts/customer-session-exchange.md) 的分類表）。

## 情境 6：未綁定客戶資料 → 拒絕換發並提示補綁定（User Story 3 情境 2, FR-007）

1. 用一個**從未**透過訂單分享連結綁定過的 LINE 測試帳號登入。
2. **預期結果**：換發請求回應 400 `LINE_NOT_BOUND`；畫面顯示提示引導客戶先完成訂單綁定。

## 情境 7：後端服務錯誤 → 服務類錯誤 + 重試按鈕（User Story 3 情境 3, FR-006）

1. 暫時關閉本機後端服務（或用瀏覽器開發者工具將 `/api/public/customers/session` 設為離線/逾時）。
2. 觸發換發。
3. **預期結果**：畫面顯示「服務暫時無法使用，請稍後再試」，並出現「重試」按鈕；點擊重試會重新呼叫換發端點。
4. 恢復後端服務後點擊重試，確認能成功換發。

## 驗證清單摘要

| 情境 | 對應 Success Criteria |
|---|---|
| 1 | SC-001 |
| 2 | — (FR-002 澄清項) |
| 3 | SC-003 |
| 4 | SC-003, FR-005 |
| 5, 6, 7 | SC-002, SC-004 |
