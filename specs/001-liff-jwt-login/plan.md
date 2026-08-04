# Implementation Plan: LIFF 登入取得後端 JWT 授權

**Branch**: `001-liff-jwt-login` | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-liff-jwt-login/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

客戶在 LIFF 內完成 LINE 登入後，前端將其 LINE 身分憑證換發為後端核發、效期 30 分鐘的授權憑證，並用 `sessionStorage` 保存以便同一工作階段內重複使用；換發機制本身不強制導頁，僅將「尚未登入」狀態暴露給頁面，由各頁面自行決定登入按鈕的呈現（沿用 `OrderView.vue` 既有手動按鈕模式）。技術作法：新增一個與頁面無關的共用 composable（`useCustomerSession`），封裝 LIFF 初始化、換發、儲存、自動重新換發、與錯誤分類（身分類 vs 服務類）等邏輯，讓現有 `OrderView.vue` 與未來新增的 LIFF 頁面都能重用同一套邏輯，不需要各自重新實作。

## Technical Context

**Language/Version**: TypeScript 5.9（Vue 3.5 `<script setup lang="ts">`），建置目標為現代行動/桌面瀏覽器（LINE LIFF 內建瀏覽器為 Chromium/WebKit 核心）

**Primary Dependencies**: `@line/liff` ^2.29.1、`axios` ^1.18.0、`vue-router` ^4.6.4、`vue-i18n` ^11.4.6 — 均為既有相依套件，本功能不新增第三方套件

**Storage**: 客戶端 `sessionStorage`（瀏覽器內建；本 repo 為純前端專案，沒有後端資料庫層）

**Testing**: 本 repo 目前未設定任何測試框架（無 `vitest`/`jest`，`package.json` 也沒有 `test` script，與 `CLAUDE.md` 所述現況一致）；本功能沿用現況，以 `quickstart.md` 列出的手動驗證步驟作為驗收依據，不在本次規劃中額外引入測試框架

**Target Platform**: 瀏覽器（LINE LIFF 內建瀏覽器 + 一般行動/桌面瀏覽器），建置為靜態檔案由 nginx 服務（見 `Dockerfile`／`nginx.conf`）

**Project Type**: web frontend（單一前端專案；後端 `V3.Public.Api` 為獨立 repo，透過 REST API 溝通，換發端點的後端實作不在本次規劃範圍內）

**Performance Goals**: 依 spec SC-001，已登入客戶開啟頁面後，授權換發於背景 3 秒內完成

**Constraints**:
- 授權憑證效期 30 分鐘（FR-005）
- 授權憑證以瀏覽器工作階段儲存（`sessionStorage`）保存，工作階段結束即失效（FR-004）
- 換發前提為該 LINE 身分已透過既有訂單綁定流程綁定客戶資料，未滿足則拒絕換發（FR-007）
- 不做即時撤銷檢查，解除綁定後既有憑證可沿用至自然過期（FR-009，後端行為，前端不需處理）
- 換發機制不得自動導頁；「尚未登入」狀態的 UI 呈現由各頁面自行決定（FR-002）

**Scale/Scope**: 新增一個與頁面無關的共用 composable，並整合進現有 `OrderView.vue`；供未來新增的 LIFF 頁面重用（FR-008），本次不新增其他頁面

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 目前仍是未填寫的樣板（`[PROJECT_NAME] Constitution` 佔位符，沒有任何具體原則），此專案尚未定義治理規範。因此沒有可套用的 gate；本節僅記錄此事實，不視為違規，不需要 Complexity Tracking 的例外說明。

**Post-Phase 1 re-check**: 無變化——設計階段沒有引入任何需要對照治理原則檢查的決策（見下方 Phase 1 產出）。

## Project Structure

### Documentation (this feature)

```text
specs/001-liff-jwt-login/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── customer-session-exchange.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── composables/
│   └── useCustomerSession.ts   # NEW — 共用的授權換發/儲存/重新換發邏輯（FR-002~FR-009）
├── views/
│   └── OrderView.vue           # MODIFIED — 改用 useCustomerSession 取代目前手寫的
│                                #   liff.init()/isLoggedIn()/getIDToken() 綁定邏輯，
│                                #   UI 呈現（登入/綁定按鈕）維持頁面自行決定
└── i18n.ts                     # MODIFIED — 補上換發失敗（身分類/服務類）的錯誤文案
```

**Structure Decision**: 單一前端專案（Option 1），不涉及後端程式碼變更。新增 `src/composables/` 目錄——這是本 repo 第一個 composable，理由是 FR-008 明確要求換發邏輯必須與頁面無關、可供任何 LIFF 頁面重用；`CLAUDE.md` 原先「不另外抽 service/composable 層」的慣例是針對單一頁面內的一次性 API 呼叫（如 `ProductDetailView`），與本功能「同一套邏輯需被多個頁面重用」的前提不同，因此在此新增最小必要的一個 composable 是合理且必要的最小抽象，而非過度設計。`OrderView.vue` 既有的手動綁定按鈕 UI 與 `attemptAutoBind`/`handleBind` 的頁面層邏輯保留，只把其中呼叫 LIFF SDK 換取憑證、呼叫換發 API、儲存/重用授權憑證的部分改為呼叫 composable。

## Complexity Tracking

*No Constitution Check violations — this section is not applicable.*
