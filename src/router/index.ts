import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
import OrderView from '../views/OrderView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    minimal?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/product/:id',
    name: 'product-detail',
    component: ProductDetailView
  },
  {
    path: '/order',
    name: 'order',
    component: OrderView,
    meta: { minimal: true }
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

export default router
