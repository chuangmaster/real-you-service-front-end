# Spec: Rename Inventory Route and View Component to Product

- **Date**: 2026-06-22
- **Topic**: Rename Inventory to Product

## 1. Goal
Modify the frontend route path from `/inventory/:id` to `/product/:id`. Rename the associated components and routes from "inventory" to "product" to keep code consistency, while maintaining the backend API path (`/api/public/inventory/:id`) unchanged.

## 2. Requirements & Scope
- Change route path `/inventory/:id` to `/product/:id`.
- Rename route name `inventory-detail` to `product-detail`.
- Rename file `InventoryDetailView.vue` to `ProductDetailView.vue`.
- Update `src/router/index.js` imports and routes.
- Update `src/views/HomeView.vue` router push navigation target.
- Do NOT change backend API request url `/api/public/inventory/${id}` in the product detail view component.

## 3. Detailed Changes

### File Rename
- Rename `src/views/InventoryDetailView.vue` -> `src/views/ProductDetailView.vue`

### `src/router/index.js`
- Change import path and component name:
  - From: `import InventoryDetailView from '../views/InventoryDetailView.vue'`
  - To: `import ProductDetailView from '../views/ProductDetailView.vue'`
- Change route rule:
  - From:
    ```javascript
    {
      path: '/inventory/:id',
      name: 'inventory-detail',
      component: InventoryDetailView
    }
    ```
  - To:
    ```javascript
    {
      path: '/product/:id',
      name: 'product-detail',
      component: ProductDetailView
    }
    ```

### `src/views/HomeView.vue`
- Change navigation routing:
  - From: `router.push({ name: 'inventory-detail', params: { id: cleanId } })`
  - To: `router.push({ name: 'product-detail', params: { id: cleanId } })`

### `src/views/ProductDetailView.vue` (formerly `InventoryDetailView.vue`)
- Keep API request endpoint as `/api/public/inventory/${id}`:
  - `const response = await axios.get(\`/api/public/inventory/\${id}\`)`
