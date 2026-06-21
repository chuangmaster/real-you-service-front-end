# Brand Identity Redesign Spec (REAL YOU)

## 1. Overview
This specification details the transition from legacy brand references ("VERITAS") to the new "REAL YOU" brand identity in the frontend project. It details the styling requirements for the sidebar logo, print brand banner, and overall alignment of the translation/text references in the project.

---

## 2. Requirements

### 2.1 Sidebar Logo Component
* **Path**: `src/layouts/components/Logo/index.vue`
* **Props**:
  * `collapse`: Boolean indicating if the sidebar is in a collapsed state.
  * `isTop`: Boolean indicating if the navigation layout is placed at the top (affects height binding).
* **States**:
  * **Expanded (`!collapse`)**: Shows `<span class="layout-logo-text">REAL YOU</span>`.
  * **Collapsed (`collapse`)**: Shows `<span class="layout-logo-abbr">RY</span>`.
* **Styling & Layout**:
  * Height bound to CSS variable:
    * Under normal sidebar (default): `--v3-header-height`.
    * Under top navigation: `--v3-navigationbar-height`.
  * Fully centered alignment.
  * `<transition name="layout-logo-fade">` transitions opacity between states.
  * Custom font: `AFuturaOrto` (fallback: `sans-serif`).
  * CSS Details:
    ```css
    .layout-logo-text {
      font-family: "AFuturaOrto", sans-serif;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 5px;
      color: var(--v3-sidebar-menu-active-text-color);
      line-height: 1;
      white-space: nowrap;
    }
    .layout-logo-abbr {
      font-family: "AFuturaOrto", sans-serif;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 3px;
      color: var(--v3-sidebar-menu-active-text-color);
      line-height: 1;
      white-space: nowrap;
    }
    ```

### 2.2 Print Brand Banner Component
* **Path**: `src/pages/order-management/components/BrandBanner.vue`
* **Styling & Layout**:
  * Structured as a flexbox column, fully centered.
  * Contains three text elements:
    1. Logo: `<h2 class="brand-logo-text">REAL YOU</h2>` (28px font, letter-spacing 6px, color: `var(--el-text-color-primary)`).
    2. Slogan: `.brand-slogan` ("無懼追求唯真世代", 12px font, letter-spacing 8px).
    3. Subtitle: `.brand-subtitle` ("— LVMH 集團授權鑑定中心 —", 7.2px font, letter-spacing 3px).
  * Common overflow handling: `text-overflow: ellipsis`, `overflow: hidden`, `white-space: nowrap` for all three texts to prevent rendering issues when printing.
  * CSS Details:
    ```css
    .brand-logo-text {
      font-family: "AFuturaOrto", sans-serif;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 6px;
      margin: 0 0 8px;
      color: var(--el-text-color-primary);
      line-height: 1;
      white-space: nowrap;
    }
    ```

### 2.3 Legacy "VERITAS" Brand Rename
* **Files to edit**:
  * `src/App.vue`
  * `src/i18n.js`
* **Changes**:
  * Replace footer brand `VERITAS` with `REAL YOU`.
  * Replace translation values `VERITAS CERTIFICATE` and `VERITAS 鑑定證書` with `REAL YOU CERTIFICATE` and `REAL YOU 鑑定證書`.
  * Replace copyright text `VERITAS LUXURY AUTHENTICATION` and `VERITAS 奢華鑑定` with `REAL YOU LUXURY AUTHENTICATION` and `REAL YOU 奢華鑑定`.

---

## 3. Architecture & Style Integration
* Custom font-family `AFuturaOrto` will be defined locally (using `@font-face` fallbacks) or resolved by the client's parent theme.
* Styles are scoped to components to ensure standard Element Plus variables like `var(--el-text-color-primary)` and custom layout variables function natively in their target layouts.
