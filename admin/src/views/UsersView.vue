<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { adminApi } from '../services/api'
import type { AdminUser, PageResponse } from '../types'

const data = ref<PageResponse<AdminUser>>({ items: [], total: 0, page: 1, pageSize: 20 })
const filters = reactive({ search: '', status: '' })
const loading = ref(false)
let timer: number | undefined

async function load(page = 1) {
  loading.value = true
  try { data.value = await adminApi.users({ ...filters, page, pageSize: 20 }) }
  finally { loading.value = false }
}
function search() { window.clearTimeout(timer); timer = window.setTimeout(() => void load(), 300) }
function formatDate(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }) }
onMounted(load)
</script>

<template>
  <section class="data-page">
    <div class="toolbar"><div class="search-input"><span>⌕</span><input v-model="filters.search" placeholder="搜索昵称或完整用户 ID" @input="search" /></div><select v-model="filters.status" @change="load()"><option value="">全部状态</option><option>ACTIVE</option><option>DISABLED</option><option>DELETED</option></select><button class="refresh-button" @click="load(data.page)">刷新</button></div>
    <article class="table-panel">
      <div class="table-meta"><strong>用户列表</strong><span>共 {{ data.total }} 位用户</span></div>
      <div class="table-scroll"><table><thead><tr><th>用户</th><th>状态</th><th>错题</th><th>AI 任务</th><th>复习任务</th><th>注册时间</th></tr></thead><tbody><tr v-for="item in data.items" :key="item.id"><td><div class="user-cell"><div class="mini-avatar">{{ (item.nickname || '用').slice(0, 1) }}</div><div><strong>{{ item.nickname || '未设置昵称' }}</strong><small>{{ item.id }}</small></div></div></td><td><span class="status-badge" :class="item.status.toLowerCase()">{{ item.status }}</span></td><td>{{ item._count.questions }}</td><td>{{ item._count.analysisJobs }}</td><td>{{ item._count.reviewTasks }}</td><td>{{ formatDate(item.createdAt) }}</td></tr><tr v-if="!data.items.length"><td colspan="6" class="empty-row">{{ loading ? '正在加载…' : '暂无匹配用户' }}</td></tr></tbody></table></div>
      <div class="pagination"><button :disabled="data.page <= 1" @click="load(data.page - 1)">上一页</button><span>第 {{ data.page }} 页</span><button :disabled="data.page * data.pageSize >= data.total" @click="load(data.page + 1)">下一页</button></div>
    </article>
  </section>
</template>
