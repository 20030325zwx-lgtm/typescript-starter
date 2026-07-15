<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAdminUsername, logoutAdmin } from '../services/api'

const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const title = computed(() => String(route.meta.title || '管理中心'))
const subtitle = computed(() => String(route.meta.subtitle || ''))
const navItems = [
  { to: '/dashboard', label: '业务总览', icon: '◫' },
  { to: '/users', label: '用户数据', icon: '◎' },
  { to: '/questions', label: '错题数据', icon: '▤' },
  { to: '/operations', label: '运行监控', icon: '⌁' },
]

function logout() {
  logoutAdmin()
  void router.replace('/login')
}
</script>

<template>
  <div class="admin-shell">
    <aside class="sidebar" :class="{ open: menuOpen }">
      <div class="brand">
        <div class="brand-mark">行</div>
        <div><strong>行测复盘</strong><span>运营管理中心</span></div>
      </div>
      <nav>
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" @click="menuOpen = false">
          <span class="nav-icon">{{ item.icon }}</span><span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar-foot">
        <div class="system-status"><i />服务数据只读模式</div>
        <span>Learn App Admin v0.1</span>
      </div>
    </aside>
    <div v-if="menuOpen" class="sidebar-mask" @click="menuOpen = false" />

    <main class="main-area">
      <header class="topbar">
        <button class="menu-button" @click="menuOpen = !menuOpen">☰</button>
        <div class="page-title"><h1>{{ title }}</h1><p>{{ subtitle }}</p></div>
        <div class="admin-profile">
          <div class="avatar">管</div>
          <div><strong>{{ getAdminUsername() }}</strong><span>只读管理员</span></div>
          <button title="退出登录" @click="logout">退出</button>
        </div>
      </header>
      <div class="content-area"><RouterView /></div>
    </main>
  </div>
</template>
