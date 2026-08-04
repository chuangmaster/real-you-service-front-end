# Phase 0 Research: LIFF 登入取得後端 JWT 授權

## 1. 換發端點的請求/回應契約

**Decision**: 前端假設一個尚未存在的後端端點 `POST /api/public/customers/session`，request body 只需要 `{ lineIdToken: string }`；成功回應比照現有 `ApiResponseModel<T>` 包裝，回傳 `{ success: true, data: { token, expiresInSeconds } }`；失敗回應沿用現有 `ResponseCodes` 慣例，新增 `LINE_NOT_BOUND`（對應 FR-007 未綁定的拒絕情境），並沿用既有的 `INVALID_LINE_TOKEN`。完整契約寫入 `contracts/customer-session-exchange.md`。

**Rationale**: 檢視後端 repo（`real-you-back-end`）現有的 `PublicOrderController`／`BindOrderLineRequest`／`ResponseCodes`，換發 LINE 身分的驗證邏輯已經有 `ILineIdTokenVerificationService`、`ICustomerLineBindingService` 可重用，不需要 order 分享 token（`t`）——因為換發前提只依賴「這個 LINE 身分是否已綁定過某個客戶」，跟訂單本身無關（見 spec FR-007／FR-008：不限定在訂單頁面）。因此端點路徑選在 `/api/public/customers/...` 而非 `/api/public/orders/...`，語意上更貼近「客戶身分換發」而非「訂單」。沿用既有 `ApiResponseModel`/`ResponseCodes` 命名慣例，降低後端實作與現有程式碼風格不一致的風險。

**Alternatives considered**:
- 沿用 `POST /api/public/orders/bind` 的 `t` 參數模式，換發時一併帶入 order token → 否決，因為 FR-008 要求任何 LIFF 頁面都能觸發換發，不是每個頁面都會有 order token 這個上下文。
- 端點放在 `/api/public/auth/...` → 語意上容易與後台帳密登入（`AuthController`，`V3.Admin.Backend` 命名空間）混淆，改用 `customers` 命名空間區隔客戶端與後台。

## 2. 授權憑證的請求附帶方式

**Decision**: 新增一個共用的 axios 實例（於 composable 內部建立，不影響現有頁面直接 `import axios from 'axios'` 的既有慣例），透過 request interceptor 在每次請求前，若 `sessionStorage` 中有未過期的授權憑證，自動加上 `Authorization: Bearer <token>` header。

**Rationale**: 現有程式碼（`ProductDetailView.vue`、`OrderView.vue`）都是直接 `import axios from 'axios'` 呼叫全域預設實例，沒有共用 http client 層。為了不影響這些既有、不需要授權的公開端點呼叫（如 `GET /api/public/inventory/:id`），新的授權附帶邏輯應該限定在「使用 `useCustomerSession` 的呼叫方」，而不是改動全域 `axios` 預設值——避免不需要授權的既有請求意外被加上 header 而造成非預期的行為差異。

**Alternatives considered**:
- 直接設定 `axios.defaults.headers.common['Authorization']` → 否決，會讓所有既有的公開端點呼叫（含未使用本功能的頁面）都被動加上 header，擴大了影響範圍且不易追蹤。
- 每次呼叫端點時手動組 header → 否決，違背 FR-008「共用邏輯」的精神，會讓每個消費此授權的呼叫端都要重複同樣的樣板程式碼。

## 3. `sessionStorage` 的鍵值設計與多分頁行為

**Decision**: 使用單一 key（例如 `realyou.customerSession`）儲存 JSON 字串 `{ token, expiresAt }`（`expiresAt` 為 ISO 8601 絕對時間，而非剩餘秒數，避免讀取時還要額外做時間換算的邊界誤差）。`sessionStorage` 本身就是依瀏覽器分頁隔離，客戶若開兩個分頁各自造訪 LIFF 頁面，會各自獨立換發、互不影響，不需要額外的多分頁同步機制。

**Rationale**: 與 spec Clarifications 中「本身就是網站結構，所以應該可以存在 session」的決議（FR-004）直接對應；`sessionStorage` 是瀏覽器原生機制，天生滿足「同一分頁/工作階段內沿用、分頁關閉即失效」的需求，不需要額外程式碼處理過期清除。

**Alternatives considered**:
- `localStorage`（跨分頁、長期持續）→ 已在 spec clarify 階段否決（見 FR-004），會超出 30 分鐘效期加上工作階段限定的既定範圍。
- 存在記憶體變數（不落地）→ 否決，會讓同一工作階段內「重新整理頁面仍可沿用」（User Story 2）失效，因為記憶體狀態在 reload 時會被清空。

## 4. LIFF ID Token 的取得與有效性

**Decision**: 沿用 `OrderView.vue` 既有作法：`liff.init({ liffId })` 於 composable 初次呼叫時執行一次（模組層級旗標避免重複初始化），透過 `liff.isLoggedIn()` 判斷登入狀態、`liff.getIDToken()` 取得目前有效的 ID Token 用於換發。不快取 ID Token 本身——每次需要換發時即時呼叫 `liff.getIDToken()`，因為 LIFF SDK 本身已經管理 LINE 登入狀態的有效性，前端不需要重新實作一套 token 快取。

**Rationale**: 與現有 `OrderView.vue` 的 `initLiff()`／`attemptAutoBind()`／`handleBind()` 使用模式一致，降低改動幅度；`liff.init()` 是冪等的初始化動作，用一個模組層級的 `initPromise` 包裝可以讓多個呼叫者（例如同一頁面內多個元件、或未來多個 LIFF 頁面共用同一個 composable 實例快取）安全地共用同一次初始化結果。

**Alternatives considered**: 無實質替代方案——`@line/liff` SDK 本身只提供這一組 API，沒有其他取得 ID Token 的途徑。

## 5. 換發失敗的分類判斷邏輯（對應 FR-006）

**Decision**: 依 HTTP 狀態碼與後端回傳的 `code` 欄位分類：
- 400 + `code` 為 `INVALID_LINE_TOKEN` 或 `LINE_NOT_BOUND` → 身分類錯誤。
- 網路層錯誤（無回應）、408/5xx → 服務類錯誤，UI 顯示重試按鈕。
- 其餘非預期狀態碼 → 比照服務類錯誤處理（保守判斷，避免把未知錯誤誤判成身分問題而誤導客戶）。

**Rationale**: 直接對應 spec FR-006 的兩分類要求，判斷邏輯集中寫在 composable 裡的一個純函式（例如 `classifyExchangeError`），方便未來新增分類時只改一處。

**Alternatives considered**: 讓各頁面各自判斷錯誤分類 → 否決，違反 FR-008 共用邏輯的精神，且容易造成頁面間分類不一致。

## 6. composable 對外介面設計

**Decision**: `useCustomerSession()` 回傳：
- `sessionReady: Ref<boolean>` — 是否持有目前有效的授權憑證
- `isLiffLoggedIn: Ref<boolean>` — 目前的 LINE 登入狀態（供頁面決定是否顯示登入按鈕，對應 FR-002）
- `exchangeError: Ref<{ kind: 'identity' | 'service'; code?: string } | null>` — 最近一次換發失敗的分類結果
- `ensureSession(): Promise<string | null>` — 確保有可用的授權憑證（沿用既有或重新換發），回傳 token 或 `null`
- `login(): void` — 顯式觸發 `liff.login({ redirectUri: window.location.href })`，只有頁面呼叫（例如客戶點擊登入按鈕）才會被呼叫，composable 本身初始化階段不主動呼叫（對應 FR-002 的澄清結論）

**Rationale**: 這組介面讓 `OrderView.vue` 現有的 `attemptAutoBind`／`handleBind` 幾乎不需要改動呼叫時機，只需要把其中直接操作 `liff.*` 與換發 API 的部分換成呼叫這幾個方法／讀取這幾個狀態，其餘頁面層的 UI 邏輯（何時顯示按鈕、何時顯示 loading）維持不動。

**Alternatives considered**: 用單一 Pinia store 取代 composable → 否決，本 repo 目前沒有導入狀態管理套件，且此功能的狀態範圍夠小（單一 session 物件），composable + `sessionStorage` 已經足夠，不需要新增這個相依套件與其學習/維護成本。

## 7. i18n 文案新增慣例

**Decision**: 沿用 `src/i18n.ts` 現有的 `order.*` 命名風格，在同一個檔案內新增 `order.session.*` 命名空間（例如 `order.session.errorIdentity`、`order.session.errorService`、`order.session.retry`），`en` 與 `zh-TW` 都補齊。若未來有其他 LIFF 頁面重用這組文案，屆時再評估是否要改成更通用的頂層命名空間（例如 `session.*`）——目前只有 `OrderView.vue` 一個消費端，不需要提前抽象命名空間。

**Rationale**: 符合 `CLAUDE.md` 的既有慣例（單一 `i18n.ts` 檔案、無外部翻譯載入機制），也符合 YAGNI（沒有第二個消費端之前不需要決定通用命名）。
