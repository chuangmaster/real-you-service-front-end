import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
import OrderView from '../views/OrderView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    minimal?: boolean
    title?: string
  }
}

const DEFAULT_TITLE = 'REAL YOU'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: 'REAL YOU | 精品鑑定查詢' }
  },
  {
    path: '/product/:id',
    name: 'product-detail',
    component: ProductDetailView,
    meta: { title: 'REAL YOU | 精品鑑定證書' }
  },
  {
    path: '/order',
    name: 'order',
    component: OrderView,
    meta: { minimal: true, title: 'REAL YOU | 訂單詳情' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Sets a route-specific document title on every navigation. Views that load
// data asynchronously (ProductDetailView, OrderView) further refine this
// once their fetch resolves (e.g. appending the brand/style or order number).
router.afterEach((to) => {
  document.title = to.meta.title || DEFAULT_TITLE
})

export default router
