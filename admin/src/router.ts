import { createRouter, createWebHashHistory } from 'vue-router'
import { hasAdminToken } from './services/api'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('./components/AdminLayout.vue'),
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard', component: () => import('./views/DashboardView.vue'), meta: { title: '业务总览', subtitle: '用户、错题、AI 与复习的实时运行数据' } },
        { path: 'users', component: () => import('./views/UsersView.vue'), meta: { title: '用户数据', subtitle: '查看用户规模与学习活跃情况' } },
        { path: 'questions', component: () => import('./views/QuestionsView.vue'), meta: { title: '错题数据', subtitle: '追踪题目状态、知识点和 AI 诊断' } },
        { path: 'operations', component: () => import('./views/OperationsView.vue'), meta: { title: '运行监控', subtitle: 'AI 任务与复习任务运行状态' } },
      ],
    },
  ],
})

router.beforeEach((to) => {
  if (!to.meta.public && !hasAdminToken())
    return '/login'
  if (to.path === '/login' && hasAdminToken())
    return '/dashboard'
})
