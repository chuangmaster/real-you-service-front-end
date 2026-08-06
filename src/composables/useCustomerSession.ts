// 客戶授權工作階段（Customer Session）共用邏輯。
// 封裝 LIFF 登入狀態判斷、向後端換發授權憑證、sessionStorage 儲存與重用、
// 換發失敗的分類，供任何 LIFF 頁面重用（見 specs/001-liff-jwt-login/）。
//
// 實際串接的後端端點是 POST /api/public/member/login（非規劃階段
// specs/001-liff-jwt-login/contracts/customer-session-exchange.md 假設的
// /api/public/customers/session，該文件已於 2026-08-06 補上對應說明）。
import { ref } from 'vue'
import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import liff from '@line/liff'

const STORAGE_KEY = 'realyou.customerSession'

// ---- 資料模型（見 data-model.md）----

export interface CustomerSession {
  /** 後端核發的授權憑證（JWT，後端回應欄位為 accessToken），用於後續請求的 Authorization header */
  token: string
  /** 絕對過期時間（ISO 8601），由換發當下 + expiresIn 秒數換算而來 */
  expiresAt: string
}

export interface LineIdentityCredential {
  /** liff.getIDToken() 取得的 LINE ID Token，換發請求的唯一輸入 */
  lineIdToken: string
}

export interface ExchangeError {
  /** 依 research.md §5 的規則分類：身分類或服務類 */
  kind: 'identity' | 'service'
  /**
   * 身分類錯誤時，後端回傳的 ResponseCodes：
   * - `INVALID_LINE_TOKEN`（401）：LINE ID Token 驗證失敗
   * - `NOT_BOUND`（403）：該 LINE 帳號尚未完成綁定
   * - `TOKEN_INVALIDATED`：非後端回傳碼，前端自訂——受保護端點回應 401
   *   時代表 security stamp 比對失敗（例如密碼被異動），憑證雖未過期但
   *   已被後端主動作廢
   */
  code?: string
}

// ---- sessionStorage 讀寫輔助函式 ----
// 單一 key 儲存 { token, expiresAt }；讀取時若已過期視為不存在（不主動清除，
// 避免換發失敗時誤刪仍在效期內的既有憑證，見 data-model.md 驗證規則）。

function readStoredSession(): CustomerSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<CustomerSession>
    if (!parsed.token || !parsed.expiresAt) return null
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null
    return { token: parsed.token, expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

function writeStoredSession(session: CustomerSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function clearStoredSession(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

// ---- LIFF 初始化包裝 ----
// 模組層級的 initPromise，確保 liff.init() 在整個頁面生命週期只執行一次，
// 即使多個元件同時呼叫 ensureSession() 也共用同一次初始化結果。

let liffInitPromise: Promise<boolean> | null = null

function ensureLiffInit(): Promise<boolean> {
  if (!liffInitPromise) {
    liffInitPromise = liff
      .init({ liffId: import.meta.env.VITE_LIFF_ID })
      .then(() => true)
      .catch((err) => {
        console.error('Failed to initialize LIFF:', err)
        liffInitPromise = null // 初始化失敗時允許下次呼叫重試
        return false
      })
  }
  return liffInitPromise
}

// ---- 授權附帶用的專屬 axios 實例 ----
// 不修改全域 axios 預設值，避免影響既有不需授權的公開端點呼叫
// （例如 ProductDetailView 的 GET /api/public/inventory/:id）。
// 供未來會呼叫受保護端點的頁面/composable 使用。

export const sessionHttp: AxiosInstance = axios.create()

sessionHttp.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const session = readStoredSession()
  if (session) {
    config.headers.set('Authorization', `Bearer ${session.token}`)
  }
  return config
})

// ---- 換發失敗的分類（對應 FR-006）----

function classifyExchangeError(err: unknown): ExchangeError {
  if (axios.isAxiosError(err) && err.response) {
    const status = err.response.status
    const code = (err.response.data as { code?: string } | undefined)?.code
    if (status === 401 && code === 'INVALID_LINE_TOKEN') {
      return { kind: 'identity', code }
    }
    if (status === 403 && code === 'NOT_BOUND') {
      return { kind: 'identity', code }
    }
  }
  // 網路層錯誤（無回應）、429（member-login 有 rate limiting）、5xx、
  // 其他未預期狀態碼，一律歸類為服務類錯誤，避免把未知錯誤誤判成身分問題
  // 而誤導客戶。
  return { kind: 'service' }
}

// ---- 模組層級共用狀態 ----
// composable 回傳的是同一組 ref，讓同一頁面內多個元件共用同一份授權狀態。

const sessionReady = ref(readStoredSession() !== null)
const isLiffLoggedIn = ref(false)
const exchangeError = ref<ExchangeError | null>(null)

// 受保護端點（透過 sessionHttp 呼叫）回應 401，代表後端
// CustomerSecurityStampValidationMiddleware 判定憑證已被作廢（例如客戶
// 密碼被異動）——即使 client 端檢查的 expiresAt 還沒到期。這種情況不能
// 當成一般錯誤重試，要清除本地憑證並歸類為身分類錯誤，讓依賴
// exchangeError 呈現「請重新登入」文案的頁面自然反映這個狀態。
sessionHttp.interceptors.response.use(
  (response) => response,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      clearStoredSession()
      sessionReady.value = false
      exchangeError.value = { kind: 'identity', code: 'TOKEN_INVALIDATED' }
    }
    return Promise.reject(err)
  }
)

async function exchangeSession(lineIdToken: string): Promise<string | null> {
  const payload: LineIdentityCredential = { lineIdToken }
  try {
    const response = await axios.post('/api/public/member/login', payload)
    if (response.data && response.data.success) {
      const { accessToken, expiresIn } = response.data.data as {
        accessToken: string
        expiresIn: number
      }
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
      writeStoredSession({ token: accessToken, expiresAt })
      sessionReady.value = true
      exchangeError.value = null
      return accessToken
    }
    exchangeError.value = { kind: 'service' }
    return null
  } catch (err) {
    exchangeError.value = classifyExchangeError(err)
    return null
  }
}

// 同一頁面內多處同時呼叫 ensureSession() 時共用同一個進行中的 promise，
// 避免短時間內重複觸發換發請求（FR-004、FR-005 的無感重新換發）。
let ensureSessionPromise: Promise<string | null> | null = null

async function ensureSession(): Promise<string | null> {
  if (ensureSessionPromise) return ensureSessionPromise

  ensureSessionPromise = (async () => {
    const initOk = await ensureLiffInit()
    if (!initOk) {
      // LIFF SDK 初始化失敗視為服務類錯誤（見 spec.md Edge Cases 第 1 條決議）
      isLiffLoggedIn.value = false
      exchangeError.value = { kind: 'service' }
      return null
    }

    isLiffLoggedIn.value = liff.isLoggedIn()

    // 有未過期的既有憑證則直接沿用，不重新發出換發請求（FR-004）
    const existing = readStoredSession()
    if (existing) {
      exchangeError.value = null
      return existing.token
    }

    // 尚未登入 LINE：不強制導頁，僅回報狀態給頁面決定 UI（FR-002）
    if (!isLiffLoggedIn.value) {
      return null
    }

    const lineIdToken = liff.getIDToken()
    if (!lineIdToken) {
      exchangeError.value = { kind: 'service' }
      return null
    }

    return exchangeSession(lineIdToken)
  })()

  try {
    return await ensureSessionPromise
  } finally {
    ensureSessionPromise = null
  }
}

// 僅供頁面在客戶主動點擊登入/綁定按鈕時呼叫；composable 本身初始化階段
// 不會自動呼叫（FR-002 澄清結論）。
function login(): void {
  liff.login({ redirectUri: window.location.href })
}

export function useCustomerSession() {
  return {
    sessionReady,
    isLiffLoggedIn,
    exchangeError,
    ensureSession,
    login
  }
}
