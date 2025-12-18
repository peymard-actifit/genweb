import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/sites',
    name: 'Sites',
    component: () => import('@/pages/SitesPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/studio/:siteId',
    name: 'Studio',
    component: () => import('@/pages/StudioPage.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // Initialiser l'auth si pas encore fait
  if (!authStore.initialized) {
    await authStore.initialize()
  }
  
  const requiresAuth = to.meta.requiresAuth !== false
  
  if (requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/sites')
  } else {
    next()
  }
})

export default router


