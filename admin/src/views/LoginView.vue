<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { AdminApiError, loginAdmin } from '../services/api'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  if (!username.value || !password.value) {
    error.value = '请输入管理员账号和密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await loginAdmin(username.value.trim(), password.value)
    await router.replace('/dashboard')
  }
  catch (reason) {
    error.value = reason instanceof AdminApiError ? reason.message : '无法连接管理服务'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-intro">
      <div class="intro-badge">Learn App · Operations</div>
      <h1>看清每一次学习<br><span>如何产生进步</span></h1>
      <p>聚合用户、错题、AI 分析与复习任务，帮助你快速发现产品运行状态和学习闭环中的问题。</p>
      <div class="intro-grid"><div><strong>用户</strong><span>增长与活跃</span></div><div><strong>AI</strong><span>成功率与异常</span></div><div><strong>复习</strong><span>任务与完成</span></div></div>
    </section>
    <section class="login-panel">
      <div class="login-card">
        <div class="login-logo">行</div>
        <h2>登录管理中心</h2>
        <p>使用服务端环境变量中配置的管理员账号</p>
        <form @submit.prevent="submit">
          <label><span>管理员账号</span><input v-model="username" autocomplete="username" placeholder="请输入账号" /></label>
          <label><span>密码</span><input v-model="password" type="password" autocomplete="current-password" placeholder="请输入密码" /></label>
          <div v-if="error" class="form-error">{{ error }}</div>
          <button :disabled="loading">{{ loading ? '正在验证…' : '安全登录' }}</button>
        </form>
        <div class="security-tip">管理员凭据仅由后端校验，不会写入前端代码。</div>
      </div>
    </section>
  </main>
</template>
