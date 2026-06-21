# Update Brand Identity Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the styling of all brand identity "REAL YOU" text elements in the application (navbar, footer, and print banner) to use the new font family and color scheme.

**Architecture:** Modify `src/App.vue` and `src/pages/order-management/components/BrandBanner.vue` to replace Tailwind class-based styles or old color rules on brand logos with the specified CSS properties. Specifically, apply `font-family: "AFuturaOrto", sans-serif` and `color: var(--v3-sidebar-menu-active-text-color)`.

**Tech Stack:** Vue, CSS

---

### Task 1: Update Brand Styles in App.vue

**Files:**
- Modify: [src/App.vue](file:///D:/Repository/real-you/real-you-service-front-end/src/App.vue)

- [ ] **Step 1: Modify navbar and footer logo elements in App.vue**
  Change the inline classes for the logo links to use new custom class names `brand-logo-nav` and `brand-logo-footer`.
  
  ```vue
  <<<<
          <router-link to="/" class="font-display-lg text-xl tracking-widest text-primary uppercase hover:opacity-80 transition-opacity">
            REAL YOU
          </router-link>
  ====
          <router-link to="/" class="brand-logo-nav hover:opacity-80 transition-opacity">
            REAL YOU
          </router-link>
  >>>>
  <<<<
          <span class="font-display-lg text-lg tracking-widest text-primary-container">REAL YOU</span>
  ====
          <span class="brand-logo-footer">REAL YOU</span>
  >>>>
  ```

- [ ] **Step 2: Add CSS rules to App.vue style section**
  Add the `<style scoped>` rules to define `brand-logo-nav` and `brand-logo-footer`.
  
  ```vue
  <<<<
  <style scoped>
  /* Scoped styles if any */
  </style>
  ====
  <style scoped>
  .brand-logo-nav {
    font-family: "AFuturaOrto", sans-serif;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 5px;
    color: var(--v3-sidebar-menu-active-text-color);
    line-height: 1;
    white-space: nowrap;
    text-transform: uppercase;
  }

  .brand-logo-footer {
    font-family: "AFuturaOrto", sans-serif;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 5px;
    color: var(--v3-sidebar-menu-active-text-color);
    line-height: 1;
    white-space: nowrap;
    text-transform: uppercase;
  }
  </style>
  >>>>
  ```

---

### Task 2: Update Brand Styles in BrandBanner.vue

**Files:**
- Modify: [src/pages/order-management/components/BrandBanner.vue](file:///D:/Repository/real-you/real-you-service-front-end/src/pages/order-management/components/BrandBanner.vue)

- [ ] **Step 1: Modify brand-logo-text color in BrandBanner.vue**
  Change the color property of `.brand-logo-text` to `var(--v3-sidebar-menu-active-text-color)`.
  
  ```css
  <<<<
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
  ====
  .brand-logo-text {
    font-family: "AFuturaOrto", sans-serif;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 6px;
    margin: 0 0 8px;
    color: var(--v3-sidebar-menu-active-text-color);
    line-height: 1;
    white-space: nowrap;
  }
  >>>>
  ```

---

### Task 3: Verification & Commit

**Files:**
- None

- [ ] **Step 1: Verify build**
  Run: `npm run build`
  
- [ ] **Step 2: Commit changes**
  Run:
  ```bash
  git add src/App.vue src/pages/order-management/components/BrandBanner.vue docs/superpowers/plans/2026-06-21-update-brand-styles.md
  git commit -m "style: update brand font family and colors across navbar, footer, and brand banner"
  ```
