# Brand Identity Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify the brand identity of the project to REAL YOU by creating the sidebar Logo component and the print BrandBanner component, and renaming legacy "VERITAS" branding references.

**Architecture:** Create two new SFC components (`Logo` and `BrandBanner`) with scoped styling according to CSS specifications, and modify translation strings and app headers/footers in existing files.

**Tech Stack:** Vue 3, Vite, Tailwind CSS

---

### Task 1: Sidebar Logo Component

**Files:**
- Create: `src/layouts/components/Logo/index.vue`

- [ ] **Step 1: Create the Logo component**
  Create the file `src/layouts/components/Logo/index.vue` with the following content:
  ```vue
  <script setup>
  defineProps({
    collapse: {
      type: Boolean,
      default: false
    },
    isTop: {
      type: Boolean,
      default: false
    }
  })
  </script>

  <template>
    <div
      class="logo-container"
      :style="{
        height: isTop ? 'var(--v3-navigationbar-height)' : 'var(--v3-header-height)'
      }"
    >
      <transition name="layout-logo-fade" mode="out-in">
        <span v-if="!collapse" class="layout-logo-text">REAL YOU</span>
        <span v-else class="layout-logo-abbr">RY</span>
      </transition>
    </div>
  </template>

  <style scoped>
  .logo-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    overflow: hidden;
  }

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

  /* Transition Animation styles */
  .layout-logo-fade-enter-active,
  .layout-logo-fade-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
  }
  .layout-logo-fade-enter-from {
    opacity: 0;
    transform: scale(0.9);
  }
  .layout-logo-fade-leave-to {
    opacity: 0;
    transform: scale(0.9);
  }
  </style>
  ```

- [ ] **Step 2: Commit Task 1**
  ```bash
  git add src/layouts/components/Logo/index.vue
  git commit -m "feat: add sidebar Logo component"
  ```

---

### Task 2: Print Brand Banner Component

**Files:**
- Create: `src/pages/order-management/components/BrandBanner.vue`

- [ ] **Step 1: Create the BrandBanner component**
  Create the file `src/pages/order-management/components/BrandBanner.vue` with the following content:
  ```vue
  <script setup>
  // Print banner component for certificates and order sheets
  </script>

  <template>
    <div class="brand-banner-container">
      <h2 class="brand-logo-text">REAL YOU</h2>
      <div class="brand-slogan">無懼追求唯真世代</div>
      <div class="brand-subtitle">— LVMH 集團授權鑑定中心 —</div>
    </div>
  </template>

  <style scoped>
  .brand-banner-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    width: 100%;
    padding: 16px 0;
  }

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

  .brand-slogan {
    font-size: 12px;
    letter-spacing: 8px;
    margin: 0 0 4px;
    color: var(--el-text-color-primary);
  }

  .brand-subtitle {
    font-size: 7.2px;
    letter-spacing: 3px;
    color: var(--el-text-color-secondary, #909399);
  }

  /* Prevent text overflow */
  .brand-logo-text,
  .brand-slogan,
  .brand-subtitle {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    max-width: 100%;
  }
  </style>
  ```

- [ ] **Step 2: Commit Task 2**
  ```bash
  git add src/pages/order-management/components/BrandBanner.vue
  git commit -m "feat: add print BrandBanner component"
  ```

---

### Task 3: Rename "VERITAS" Brand References and Verify Build

**Files:**
- Modify: `src/App.vue`
- Modify: `src/i18n.js`

- [ ] **Step 1: Update App.vue**
  Replace `VERITAS` with `REAL YOU` in `src/App.vue` (footer text on line 40).
  ```vue
  <!-- Change: -->
  <span class="font-display-lg text-lg tracking-widest text-primary-container">VERITAS</span>
  <!-- To: -->
  <span class="font-display-lg text-lg tracking-widest text-primary-container">REAL YOU</span>
  ```

- [ ] **Step 2: Update i18n.js**
  Replace branding keys/values in English and Traditional Chinese messages inside `src/i18n.js`.
  * Line 10 (English Title): Change `'VERITAS CERTIFICATE'` to `'REAL YOU CERTIFICATE'`.
  * Line 59 (English Copyright): Change `'© 2026 VERITAS LUXURY AUTHENTICATION. ALL RIGHTS RESERVED.'` to `'© 2026 REAL YOU LUXURY AUTHENTICATION. ALL RIGHTS RESERVED.'`.
  * Line 68 (Traditional Chinese Title): Change `'VERITAS 鑑定證書'` to `'REAL YOU 鑑定證書'`.
  * Line 117 (Traditional Chinese Copyright): Change `'© 2026 VERITAS 奢華鑑定。版權所有。'` to `'© 2026 REAL YOU 奢華鑑定。版權所有。'`.

- [ ] **Step 3: Run local build to verify correctness**
  Run command: `npm run build`
  Expected: Build succeeds without any compilation or TypeScript errors.

- [ ] **Step 4: Commit Task 3**
  ```bash
  git add src/App.vue src/i18n.js
  git commit -m "refactor: rename legacy VERITAS brand to REAL YOU"
  ```
