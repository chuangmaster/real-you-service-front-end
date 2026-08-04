---

description: "Task list for LIFF 登入取得後端 JWT 授權"

---

# Tasks: LIFF 登入取得後端 JWT 授權

**Input**: Design documents from `/specs/001-liff-jwt-login/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/customer-session-exchange.md](./contracts/customer-session-exchange.md), [quickstart.md](./quickstart.md)

**Tests**: 本 repo 目前未設定任何測試框架（見 `plan.md` Technical Context），本次不引入。以下改用 `quickstart.md` 的手動驗證步驟作為每個 user story 的驗收依據，對應任務已標註於各階段。

**Organization**: 任務依 user story（P1/P2/P3）分組，讓每個 story 能被獨立完成與驗證。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、彼此無相依）
- **[Story]**: 任務所屬的 user story（US1/US2/US3）
- 每個任務都附精確檔案路徑

## Path Conventions

單一前端專案（見 `plan.md` Project Structure）：

- `src/composables/useCustomerSession.ts`（新增）
- `src/views/OrderView.vue`（修改）
- `src/i18n.ts`（修改）

---

## Phase 1: Setup

**Purpose**: 建立本 repo 第一個 composable 的檔案骨架

- [X] T001 建立 `src/composables/` 目錄與 `useCustomerSession.ts` 檔案骨架（匯出一個目前為空殼的 `useCustomerSession()` function），路徑 `src/composables/useCustomerSession.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 所有 user story 都依賴的共用建構區塊（型別、儲存、LIFF 初始化、HTTP client、錯誤分類）

**⚠️ CRITICAL**: 本階段完成前，不得開始任何 user story 的實作

- [X] T002 依 [data-model.md](./data-model.md) 在 `src/composables/useCustomerSession.ts` 定義 `CustomerSession`（`token`、`expiresAt`）、`LineIdentityCredential`（`lineIdToken`）、`ExchangeError`（`kind`、`code`）TypeScript 型別
- [X] T003 依 [research.md §3](./research.md#3-sessionstorage-的鍵值設計與多分頁行為) 在 `src/composables/useCustomerSession.ts` 實作 `sessionStorage` 讀寫/清除輔助函式（單一 key `realyou.customerSession`，JSON 內容 `{ token, expiresAt }`；讀取時若 `expiresAt` 已過期視為不存在，對應 [data-model.md](./data-model.md) 的驗證規則）
- [X] T004 依 [research.md §4](./research.md#4-liff-id-token-的取得與有效性) 在 `src/composables/useCustomerSession.ts` 實作模組層級的 LIFF 初始化包裝（`initPromise` 確保 `liff.init()` 只執行一次）與 `isLiffLoggedIn` ref
- [X] T005 依 [research.md §2](./research.md#2-授權憑證的請求附帶方式) 在 `src/composables/useCustomerSession.ts` 建立專屬的 axios 實例，透過 request interceptor 在有未過期 session 時自動附加 `Authorization: Bearer <token>` header（不得影響全域 `axios` 預設實例）
- [X] T006 依 [research.md §5](./research.md#5-換發失敗的分類判斷邏輯對應-fr-006) 與 [contracts/customer-session-exchange.md](./contracts/customer-session-exchange.md) 在 `src/composables/useCustomerSession.ts` 實作純函式 `classifyExchangeError(err)`，依 HTTP 狀態碼與 `code` 欄位分類為 `identity` 或 `service`

**Checkpoint**: composable 的共用建構區塊就緒，可開始疊加各 user story 的對外行為

---

## Phase 3: User Story 1 - LIFF 登入後換發後端授權憑證 (Priority: P1) 🎯 MVP

**Goal**: 客戶已在 LIFF 內登入 LINE 且該身分已綁定客戶資料時，前端在背景自動換發後端授權憑證；尚未登入時不強制導頁，交由頁面決定 UI。

**Independent Test**: 在已完成 LINE 綁定的帳號下，透過 LIFF 開啟頁面並確認已登入，驗證前端能取得有效期內的授權憑證並能用其對受保護端點成功發出請求（見 `quickstart.md` 情境 1、2）。

### Implementation for User Story 1

- [X] T007 [US1] 依 [contracts/customer-session-exchange.md](./contracts/customer-session-exchange.md) 在 `src/composables/useCustomerSession.ts` 實作 `ensureSession()`：優先沿用 T003 儲存的有效 session；否則以 `liff.getIDToken()` 取得的 `lineIdToken` 呼叫 `POST /api/public/customers/session`，成功後換算 `expiresAt` 並寫入 `sessionStorage`，回傳 token 或 `null`（FR-001、FR-003、FR-004）。**註**：此處提前納入「沿用既有 session」屬於必要的基礎行為（無此檢查則每次呼叫都會重新換發），User Story 2 的獨立測試聚焦在更進階的行為——過期後自動無感重新換發（T013）與同時呼叫的防抖（T012），而非「是否沿用」本身
- [X] T008 [US1] 依 [research.md §6](./research.md#6-composable-對外介面設計) 在 `src/composables/useCustomerSession.ts` 實作 `login()`：包裝 `liff.login({ redirectUri: window.location.href })`，僅由頁面主動呼叫，composable 初始化階段不自動呼叫（FR-002）
- [X] T009 [US1] 在 `src/composables/useCustomerSession.ts` 匯出 `useCustomerSession()` 對外介面：`sessionReady`、`isLiffLoggedIn`、`exchangeError`、`ensureSession()`、`login()`（研究決策見 [research.md §6](./research.md#6-composable-對外介面設計)）
- [X] T010 [US1] 在 `src/views/OrderView.vue` 改用 `useCustomerSession`：以 composable 的 `isLiffLoggedIn`/`login()` 取代原本直接呼叫的 `liff.init()`/`liff.isLoggedIn()`/`liff.login()`，並在既有 `onMounted`／`attemptAutoBind` 流程中呼叫 `ensureSession()`，讓授權換發在背景無感完成（`plan.md` Project Structure 的 Structure Decision；FR-001~FR-004）
- [ ] T011 [US1] 依 [quickstart.md](./quickstart.md) 情境 1、情境 2 手動驗證：已登入且已綁定時 3 秒內背景完成換發且無任何提示；未登入時不強制導頁，點擊登入按鈕後導轉並自動接續換發

**Checkpoint**: User Story 1 應可獨立運作並通過驗證（MVP）

---

## Phase 4: User Story 2 - 授權狀態在有效期內延續，避免重複登入 (Priority: P2)

**Goal**: 授權憑證尚未過期前重新開啟頁面時，沿用既有授權狀態；過期後自動無感重新換發，皆不需要客戶重新跑一次 LINE 登入導轉。

**Independent Test**: 手動將 `sessionStorage` 中憑證的 `expiresAt` 改為過去時間模擬過期，觸發需授權動作後確認系統自動、無感重新換發新憑證（不呼叫 `login()`）；並確認短時間內重複觸發 `ensureSession()` 不會發出多筆重複的換發請求（見 `quickstart.md` 情境 3、4）。**註**：「有效期內沿用既有憑證」這個行為已在 US1 的 T007 內建（見 T007 註記），本 story 驗證的是其上再疊加的過期重新換發與防抖行為。

### Implementation for User Story 2

- [X] T012 [US2] 在 `src/composables/useCustomerSession.ts` 為 `ensureSession()` 加上共用的進行中 promise（比照 T004 的 `initPromise` 模式），避免同一頁面內多處同時呼叫時重複觸發換發請求
- [X] T013 [US2] 確認並視需要調整 `src/composables/useCustomerSession.ts` 的 `ensureSession()`：當儲存的 session 依 T003 判定已過期時（data-model.md 生命週期），在客戶 LINE 登入狀態仍有效的前提下直接觸發重新換發，不呼叫 `login()`（FR-005）
- [ ] T014 [US2] 依 [quickstart.md](./quickstart.md) 情境 3、情境 4 手動驗證：有效期內重新整理頁面不再發出新的換發請求（或即使發出也是背景無感）；手動竄改 `expiresAt` 模擬過期後，重新整理頁面能自動無感換發新憑證

**Checkpoint**: User Story 1、2 應可同時獨立運作

---

## Phase 5: User Story 3 - 授權失敗時的錯誤處理 (Priority: P3)

**Goal**: 授權憑證換發失敗時，依失敗原因區分身分類與服務類錯誤，給客戶清楚、友善的提示，服務類錯誤額外提供重試按鈕。

**Independent Test**: 模擬換發失敗情境（例如帶入失效的 LINE ID Token、未綁定的帳號、後端服務錯誤），確認前端依分類顯示對應錯誤提示，而非空白畫面或未處理例外（見 `quickstart.md` 情境 5、6、7）。

### Implementation for User Story 3

- [X] T015 [P] [US3] 依 [research.md §7](./research.md#7-i18n-文案新增慣例) 在 `src/i18n.ts` 新增 `order.session.*` 命名空間文案（`errorIdentity`、`errorService`、`retry`、`bindRequired`），`en` 與 `zh-TW` 都補齊
- [X] T016 [US3] 在 `src/composables/useCustomerSession.ts` 的 `ensureSession()` 換發失敗時，呼叫 T006 的 `classifyExchangeError()` 並寫入 `exchangeError` ref，供頁面讀取分類結果（FR-006）
- [X] T017 [US3] 在 `src/views/OrderView.vue` 讀取 composable 的 `exchangeError`，依 `kind` 分流呈現：身分類僅顯示引導文案，服務類額外顯示「重試」按鈕，點擊後重新呼叫 `ensureSession()`（FR-006）
- [X] T018 [US3] 在 `src/views/OrderView.vue` 針對 `exchangeError.code === 'LINE_NOT_BOUND'` 顯示 T015 新增的 `order.session.bindRequired` 文案，引導客戶先透過訂單分享連結完成綁定（FR-007）
- [X] T019 [US3] 在 `src/composables/useCustomerSession.ts` 的 LIFF 初始化流程（T004）失敗時，直接寫入 `exchangeError = { kind: 'service' }`（不經過 `classifyExchangeError`，因為沒有 HTTP 回應可供分類），比照 FR-006 服務類錯誤呈現方式（對應 spec.md Edge Cases 第 1 條的決議）
- [ ] T020 [US3] 依 [quickstart.md](./quickstart.md) 情境 5、6、7 手動驗證：身分驗證失敗顯示身分類錯誤且無重試按鈕；未綁定帳號顯示補綁定引導；後端服務錯誤顯示服務類錯誤與重試按鈕，重試後可成功換發；另補測 `liff.init()` 失敗時同樣顯示服務類錯誤與重試按鈕（T019）

**Checkpoint**: User Story 1、2、3 應皆可獨立運作

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 跨 story 的收尾與最終驗收

- [X] T021 [P] 檢視 `src/composables/useCustomerSession.ts` 是否維持與頁面無關（不得耦合 `OrderView.vue` 特有邏輯），確保未來新增的 LIFF 頁面可直接重用（FR-008）
- [ ] T022 依 [quickstart.md](./quickstart.md) 完整走過全部 7 個情境做最終回歸驗證，確認 [spec.md](./spec.md) 的 SC-001～SC-004 皆滿足

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**：無相依，可立即開始
- **Foundational (Phase 2)**：依賴 Setup 完成——會阻擋所有 user story
- **User Story 1 (Phase 3)**：依賴 Foundational 完成
- **User Story 2 (Phase 4)**：依賴 Foundational 完成；邏輯建構在 US1 的 `ensureSession()` 之上（T012、T013 修改同一份 T007 產出的函式），建議接續 US1 之後進行
- **User Story 3 (Phase 5)**：依賴 Foundational 完成；`exchangeError` 的填入（T016）建構在 US1 的 `ensureSession()` 之上，建議接續 US1/US2 之後進行
- **Polish (Phase 6)**：依賴所有 desired user story 完成

### User Story Dependencies

- **User Story 1 (P1)**：Foundational 完成後即可開始，不依賴其他 story——為 MVP
- **User Story 2 (P2)**：Foundational 完成後可開始；因與 US1 共用 `ensureSession()` 同一函式（同檔案），實務上建議 US1 完成後再進行，但驗收（quickstart 情境 3、4）可獨立確認
- **User Story 3 (P3)**：Foundational 完成後可開始；`exchangeError` 依賴 US1 的 `ensureSession()` 已能捕捉換發失敗，建議 US1 完成後再進行，但驗收（quickstart 情境 5、6、7）可獨立確認

### Within Each User Story

- Composable 邏輯先於頁面整合（US1：T007-T009 先於 T010）
- 頁面整合先於手動驗證（各 story 最後一項任務皆為 quickstart 驗證）

### Parallel Opportunities

- Setup 完成後，T002-T006 皆修改同一份 `useCustomerSession.ts`，須依序完成，不可平行
- US3 的 T015（`src/i18n.ts`）與同 story 其他任務（`useCustomerSession.ts`/`OrderView.vue`）分屬不同檔案，可平行進行
- Polish 階段的 T021（composable 檢視）與 T022（quickstart 回歸）分屬不同性質工作，可平行進行

---

## Parallel Example: User Story 3

```bash
# T015 可與同 story 其他任務平行進行（不同檔案）：
Task: "新增 order.session.* i18n 文案 in src/i18n.ts"
Task: "在 useCustomerSession.ts 寫入 exchangeError ref"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1：Setup
2. 完成 Phase 2：Foundational（CRITICAL——阻擋所有 story）
3. 完成 Phase 3：User Story 1
4. **STOP 並驗證**：依 quickstart.md 情境 1、2 獨立測試 User Story 1
5. 視需要部署/展示

### Incremental Delivery

1. 完成 Setup + Foundational → 共用建構區塊就緒
2. 加入 User Story 1 → 獨立驗證 → 部署/展示（MVP！）
3. 加入 User Story 2 → 獨立驗證 → 部署/展示
4. 加入 User Story 3 → 獨立驗證 → 部署/展示
5. 每個 story 都在不破壞前一個 story 的前提下疊加價值

---

## Notes

- [P] 任務 = 不同檔案、彼此無相依
- [Story] 標籤將任務對應到特定 user story，便於追蹤
- 每個 user story 都應可獨立完成與驗證
- 本功能無自動化測試框架，改以 quickstart.md 的手動驗證步驟作為每個 checkpoint 的驗收依據
- 避免：模糊任務、同檔案衝突、破壞 story 獨立性的跨 story 相依
