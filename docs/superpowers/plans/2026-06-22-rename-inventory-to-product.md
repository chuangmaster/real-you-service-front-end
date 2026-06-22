# Rename Inventory Route and Component to Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename inventory routes and component to product in frontend routing, keeping backend API call unchanged.

**Architecture:** Rename file InventoryDetailView.vue to ProductDetailView.vue, modify Vue Router routes, and update route transition references in HomeView.vue.

**Tech Stack:** Vue 3, Vue Router, JavaScript, git

---

### Task 1: Rename the View Component

**Files:**
- Create/Rename to: `src/views/ProductDetailView.vue`
- Delete: `src/views/InventoryDetailView.vue`

- [ ] **Step 1: Rename the file**

Rename `src/views/InventoryDetailView.vue` to `src/views/ProductDetailView.vue`.
On command line, run:
```powershell
mv src/views/InventoryDetailView.vue src/views/ProductDetailView.vue
```

- [ ] **Step 2: Verify file existence**

Run:
```powershell
Test-Path src/views/ProductDetailView.vue
```
Expected output: `True`

- [ ] **Step 3: Commit the rename**

Run:
```powershell
git add src/views/InventoryDetailView.vue src/views/ProductDetailView.vue
git commit -m "refactor: rename InventoryDetailView.vue to ProductDetailView.vue"
```


### Task 2: Update Router Configuration

**Files:**
- Modify: `src/router/index.js`

- [ ] **Step 1: Modify imports and route details**

Edit `src/router/index.js`.
Change lines 3 and 11-15:
```javascript
// Line 3:
import ProductDetailView from '../views/ProductDetailView.vue'

// Lines 11-15:
  {
    path: '/product/:id',
    name: 'product-detail',
    component: ProductDetailView
  },
```

- [ ] **Step 2: Verify code syntax by dry run build**

Run:
```powershell
npm run build
```
Expected: The build should fail or pass depending on HomeView.vue remaining changes, or check if router index compiles. Let's proceed to next task if it's simpler.

- [ ] **Step 3: Commit**

Run:
```powershell
git add src/router/index.js
git commit -m "refactor: update routes to use product instead of inventory"
```


### Task 3: Update Navigation Target in HomeView

**Files:**
- Modify: `src/views/HomeView.vue`

- [ ] **Step 1: Modify search navigation logic**

Edit `src/views/HomeView.vue`.
Change line 27:
```javascript
  router.push({ name: 'product-detail', params: { id: cleanId } })
```

- [ ] **Step 2: Verify production build succeeds**

Run:
```powershell
npm run build
```
Expected: Build completes successfully with no unresolved import or routing errors.

- [ ] **Step 3: Commit**

Run:
```powershell
git add src/views/HomeView.vue
git commit -m "refactor: update HomeView navigation route name to product-detail"
```
