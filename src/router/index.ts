import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import IdentificationReportView from '../views/IdentificationReportView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
import OrderView from '../views/OrderView.vue'
import MemberLayout from '../views/member/MemberLayout.vue'
import ProfileView from '../views/member/ProfileView.vue'
import OrderListView from '../views/member/OrderListView.vue'
import ServiceOrderDetailView from '../views/member/ServiceOrderDetailView.vue'
import SalesOrderDetailView from '../views/member/SalesOrderDetailView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    minimal?: boolean
    title?: string
    requiresAuth?: boolean
    orderKind?: 'Service' | 'Sales'
  }
}

const DEFAULT_TITLE = 'REAL YOU'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: 'REAL YOU | 精品鑑定權威' }
  },
  {
    path: '/identification-report',
    name: 'identification-report',
    component: IdentificationReportView,
    meta: { title: 'REAL YOU | 鑑定報告查詢' }
  },
  {
    path: '/identification-report/:id',
    name: 'product-detail',
    component: ProductDetailView,
    meta: { title: 'REAL YOU | 精品鑑定證書' }
  },
  {
    path: '/product/:id',
    redirect: (to) => ({ name: 'product-detail', params: to.params })
  },
  {
    path: '/order',
    name: 'order',
    component: OrderView,
    meta: { minimal: true, title: 'REAL YOU | 訂單詳情' }
  },
  {
    path: '/member',
    component: MemberLayout,
    meta: { minimal: true, requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'member-profile' } },
      {
        path: 'profile',
        name: 'member-profile',
        component: ProfileView,
        meta: { title: 'REAL YOU | 會員資料' }
      },
      {
        path: 'orders/service',
        name: 'member-orders-service',
        component: OrderListView,
        meta: { orderKind: 'Service', title: 'REAL YOU | 服務單記錄' }
      },
      {
        path: 'orders/sales',
        name: 'member-orders-sales',
        component: OrderListView,
        meta: { orderKind: 'Sales', title: 'REAL YOU | 訂單記錄' }
      },
      {
        path: 'orders/service/:id',
        name: 'member-orders-service-detail',
        component: ServiceOrderDetailView,
        meta: { title: 'REAL YOU | 服務單明細' }
      },
      {
        path: 'orders/sales/:id',
        name: 'member-orders-sales-detail',
        component: SalesOrderDetailView,
        meta: { title: 'REAL YOU | 訂單明細' }
      }
    ]
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
