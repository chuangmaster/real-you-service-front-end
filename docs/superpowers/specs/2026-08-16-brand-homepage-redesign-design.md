# 品牌首頁改版設計

## 背景

目前 `/`（`HomeView.vue`）是一個純功能性的搜尋頁：標題＋描述＋UUID 輸入框，使用者輸入商品 ID 後導向 `/product/:id` 查看鑑定證書。隨著 `/member` 會員中心上線（見 `docs/superpowers/specs/2026-08-15-liff-member-center-design.md`），網站入口已經不只一種用途，首頁若繼續維持純搜尋框的樣貌，既無法呈現品牌形象，也無法自然地把訪客導向會員中心。

`/product/:id`（鑑定證書頁）**維持公開、無需登入即可查看**——這是刻意設計，不是本次要調整的範圍：鑑定證書本來就是靠 QR code／分享連結公開查詢的核心功能，任何人拿到商品 ID 就該查得到。本次改版**只調整首頁的角色定位與導覽結構**，不涉及既有頁面的存取權限。

## 目標

- `/`（首頁）改為品牌形象頁，取代目前的功能性搜尋框樣貌。
- 現有的 UUID 搜尋功能完整搬到新路由 `/identification-report`，功能與驗證邏輯不變。
- 首頁提供兩個明確入口：查詢鑑定報告（`/identification-report`）、會員中心（`/member`）。
- Nav bar 同步調整，讓「報告檢索」連結指向真正的搜尋頁，並新增會員中心連結。

## 架構決策

### 路由

| 路徑 | Route name | 元件 | 說明 |
|---|---|---|---|
| `/` | `home` | `HomeView.vue`（改寫） | 品牌 Hero 頁，`meta.title` 改為品牌向標題 |
| `/identification-report` | `identification-report`（新增） | `IdentificationReportView.vue`（新檔案） | 原 `HomeView.vue` 的搜尋表單邏輯原樣搬遷 |

`/product/:id`、`/order`、`/member/*` 三組既有路由不變。

### 檔案異動

- **新增 `src/views/IdentificationReportView.vue`**：把現有 `HomeView.vue` 的完整內容（UUID 輸入、格式驗證、送出後 `router.push({ name: 'product-detail', params: { id } })`、錯誤訊息顯示）原樣搬過來，邏輯不變，只換i18n key 前綴（見下方 i18n 章節）。
- **改寫 `src/views/HomeView.vue`**：換成品牌 Hero 頁（見下方「首頁內容」章節），不再包含任何搜尋表單邏輯。
- **修改 `src/router/index.ts`**：新增 `/identification-report` 路由；`/` 路由的 `meta.title` 更新為品牌向標題。
- **修改 `src/App.vue`**：nav bar 的「報告檢索」連結 `router-link :to` 從 `/` 改成 `{ name: 'identification-report' }`；新增「會員中心」連結，`:to="{ name: 'member-profile' }"`（直接指向會員中心預設分頁，比指向會觸發 redirect 的 `/member` 少一次導轉）。
- **修改 `src/views/ProductDetailView.vue:377`**：錯誤畫面「RETURN TO SEARCH」按鈕的 `router-link to="/"` 改成 `to="{ name: 'identification-report' }"`——這顆按鈕語意上是「回去搜尋」，現在搜尋頁不再是 `/`，沿用 route name 而非硬寫路徑字串，跟專案其他地方的既有慣例一致（其餘 `router-link` 多半用 `:to="{ name: ... }"`）。

### 首頁內容（Hero）

只做單一 Hero 區塊，不做服務流程說明、信任背書等其他區塊（YAGNI——這些若之後需要，屬於獨立的後續規劃）。

- **版面**：桌機雙欄（圖片＋文字/CTA 並排），手機單欄堆疊（圖片在上、文字在下）。沿用現有 `HomeView.vue` 已有的背景光暈裝飾元素（`bg-primary-container/10`、`bg-primary/5` 模糊圓形），維持與其他頁面一致的視覺語言。
- **圖片**：使用專案內現有但目前未被任何頁面引用的素材 `src/assets/hero.png`（343×361px），以 `object-cover` 呈現，套用與商品圖一致的邊框/圓角處理慣例。
- **文字區**：
  - `font-data-mono` 小標籤（品牌定位語，沿用目前 `home.subtitle` 位置的視覺樣式）
  - `font-headline-md` / `Playfair Display` 主標語
  - `font-body-md` 簡短品牌描述
  - 兩個並列 CTA 按鈕：主要按鈕（`bg-primary` 實心樣式，連到 `{ name: 'identification-report' }`）＋次要按鈕（外框樣式，連到 `{ name: 'member-profile' }`）
- **不做**：服務流程說明、信任背書、精選案例等內容區塊；也不新增任何後端 API 呼叫——這一頁純靜態內容＋兩個連結。

### i18n

- **既有 `home.*` namespace（`en` + `zh-TW`）整組搬到新的 `identificationReport.*` namespace**：`title`、`subtitle`、`description`、`idLabel`、`idPlaceholder`、`verifyBtn`、`errors.required`、`errors.invalid` 的實際文案內容不變，只換 key 前綴——這些文案本來就是描述搜尋功能，功能搬到哪，文案就跟到哪。
- **新增 `home.*` namespace**（品牌頁專用，`en` + `zh-TW` 都要補齊），文案定稿如下：

| Key | zh-TW | en |
|---|---|---|
| `home.tagline` | 精品鑑定權威 | TRUSTED LUXURY AUTHENTICATION |
| `home.heroTitle` | 真偽，一眼可鑑 | Authenticity You Can Trust |
| `home.heroDescription` | REAL YOU 提供專業精品鑑定服務，結合多年鑑定團隊經驗，為您的每一件精品建立可靠的真偽證明。 | REAL YOU delivers professional luxury goods authentication, backed by years of expert inspection — giving every piece verifiable proof of authenticity. |
| `home.ctaSearch` | 查詢鑑定報告 | VIEW AUTHENTICATION REPORT |
| `home.ctaMember` | 會員中心 | MEMBER CENTER |

`ctaSearch`／`ctaMember` 沿用現有按鈕文案的全大寫＋寬字距慣例（比照 `home.verifyBtn` 現行的 `'SEARCH'`），`tagline` 沿用現有 `home.subtitle` 位置的全大寫小標籤慣例（比照現行 `'Luxury Authentication Report Lookup'`）。

- **新增 `nav.memberCenter`**（`en` + `zh-TW`）：`zh-TW` 「會員中心」、`en` "Member Center"——比照既有 `nav.searchReport`（「報告檢索」/"Search Report"）的一般大小寫（非全大寫）慣例，因為 nav bar 連結文字風格與按鈕文字風格不同。
- `nav.searchReport` 既有文案不變（「報告檢索」/「Search Report」），只改它的連結目標。

## 不在此規格範圍

- 鑑定證書頁（`/product/:id`）的存取權限——維持現況公開查詢，本次不調整。
- 首頁 Hero 以外的其他內容區塊（服務流程說明、信任背書、精選案例等）——先上線最小可行版本，其他區塊留待後續獨立規劃。
- `/member` 的任何內部功能異動——本次只新增首頁/nav bar 到 `/member` 的入口連結，不改 `/member` 系列頁面本身。
- 行動裝置 App Icon、SEO meta tag、社群分享預覽卡（Open Graph）等額外的首頁行銷素材——不在本次範圍。

## 實作注意事項

1. `IdentificationReportView.vue` 是既有 `HomeView.vue` 邏輯的「原樣搬遷」，不是重寫——搬遷時只需要替換 i18n key 前綴，UUID 格式驗證的 regex 與送出後的導轉邏輯完全不變。
2. `src/assets/hero.png` 素材已存在於專案中但目前沒有任何頁面引用，可直接 `import` 使用，不需要新增圖片檔案。
3. Nav bar 與首頁 CTA 對 `/member` 的連結一律指向 `{ name: 'member-profile' }`（會員中心預設分頁）而非裸路徑 `/member`，跳過一次 client-side redirect；點擊後仍會照常觸發 `MemberGate` 的登入流程（見 `docs/superpowers/specs/2026-08-15-liff-member-center-design.md`），對一般瀏覽器與 LIFF client 兩種情境都適用。
