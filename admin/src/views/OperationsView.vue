<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { adminApi } from '../services/api'
import type { AdminAnalysisJob, AdminFeedback, AdminReview, PageResponse } from '../types'

const tab = ref<'analysis' | 'reviews' | 'feedback'>('analysis')
const filters = reactive({ search: '', status: '' })
const loading = ref(false)
const jobs = ref<PageResponse<AdminAnalysisJob>>({ items: [], total: 0, page: 1, pageSize: 20 })
const reviews = ref<PageResponse<AdminReview>>({ items: [], total: 0, page: 1, pageSize: 20 })
const feedback = ref<PageResponse<AdminFeedback>>({ items: [], total: 0, page: 1, pageSize: 20 })
let timer: number | undefined
const current = () => tab.value === 'analysis' ? jobs.value : tab.value === 'reviews' ? reviews.value : feedback.value

async function load(page = 1) {
  loading.value = true
  try {
    if (tab.value === 'analysis') jobs.value = await adminApi.analysisJobs({ ...filters, page, pageSize: 20 })
    else if (tab.value === 'reviews') reviews.value = await adminApi.reviews({ ...filters, page, pageSize: 20 })
    else feedback.value = await adminApi.feedback({ ...filters, page, pageSize: 20 })
  }
  finally { loading.value = false }
}
function search() { window.clearTimeout(timer); timer = window.setTimeout(() => void load(), 300) }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—' }
watch(tab, () => { filters.status = ''; filters.search = ''; void load() })
onMounted(load)
</script>

<template>
  <section class="data-page">
    <div class="tab-switch"><button :class="{ active: tab === 'analysis' }" @click="tab = 'analysis'">AI 分析任务</button><button :class="{ active: tab === 'reviews' }" @click="tab = 'reviews'">复习任务</button><button :class="{ active: tab === 'feedback' }" @click="tab = 'feedback'">用户反馈</button></div>
    <div class="toolbar"><div class="search-input"><span>⌕</span><input v-model="filters.search" :placeholder="tab === 'analysis' ? '搜索错误码或完整任务/题目 ID' : tab === 'reviews' ? '搜索用户或完整任务/题目 ID' : '搜索反馈内容、类型、联系方式或用户'" @input="search" /></div><select v-model="filters.status" @change="load()"><option value="">全部状态</option><template v-if="tab === 'analysis'"><option>PENDING</option><option>RUNNING</option><option>SUCCEEDED</option><option>FAILED</option><option>CANCELLED</option></template><template v-else-if="tab === 'reviews'"><option>PENDING</option><option>COMPLETED</option><option>SKIPPED</option><option>CANCELLED</option></template><template v-else><option>PENDING</option><option>RESOLVED</option></template></select><button class="refresh-button" @click="load(current().page)">刷新</button></div>
    <article class="table-panel">
      <div class="table-meta"><strong>{{ tab === 'analysis' ? 'AI 分析任务' : tab === 'reviews' ? '复习任务' : '用户反馈' }}</strong><span>共 {{ current().total }} 条记录</span></div>
      <div class="table-scroll" v-if="tab === 'analysis'"><table><thead><tr><th>任务</th><th>用户</th><th>状态</th><th>重试</th><th>耗时</th><th>错误</th><th>创建时间</th></tr></thead><tbody><tr v-for="item in jobs.items" :key="item.id"><td><div class="question-cell"><strong>{{ item.id }}</strong><small>题目 {{ item.questionId }}</small></div></td><td>{{ item.user.nickname || '未命名用户' }}</td><td><span class="status-badge" :class="item.status.toLowerCase()">{{ item.status }}</span></td><td>{{ item.retryCount }}</td><td>{{ item.startedAt && item.finishedAt ? `${Math.max(0, Math.round((Date.parse(item.finishedAt) - Date.parse(item.startedAt)) / 1000))} 秒` : '—' }}</td><td><span :class="{ 'error-text': item.errorCode }">{{ item.errorCode || '—' }}</span><small v-if="item.errorMessageSafe" class="cell-sub">{{ item.errorMessageSafe }}</small></td><td>{{ formatDate(item.createdAt) }}</td></tr><tr v-if="!jobs.items.length"><td colspan="7" class="empty-row">{{ loading ? '正在加载…' : '暂无匹配任务' }}</td></tr></tbody></table></div>
      <div class="table-scroll" v-else-if="tab === 'reviews'"><table><thead><tr><th>复习题目</th><th>用户</th><th>周期</th><th>状态</th><th>到期时间</th><th>作答结果</th><th>自评</th></tr></thead><tbody><tr v-for="item in reviews.items" :key="item.id"><td><div class="question-cell"><strong>{{ item.question.questionText || '题干待识别' }}</strong><small>{{ item.question.id }}</small></div></td><td>{{ item.user.nickname || '未命名用户' }}</td><td>第 {{ item.cycle }} 次</td><td><span class="status-badge" :class="item.status.toLowerCase()">{{ item.status }}</span></td><td>{{ formatDate(item.dueAt) }}</td><td>{{ item.attempt?.isCorrect === true ? '正确' : item.attempt?.isCorrect === false ? '错误' : '—' }}</td><td>{{ item.attempt?.selfRating || '—' }}</td></tr><tr v-if="!reviews.items.length"><td colspan="7" class="empty-row">{{ loading ? '正在加载…' : '暂无匹配任务' }}</td></tr></tbody></table></div>
      <div class="table-scroll" v-else><table><thead><tr><th>反馈内容</th><th>类型</th><th>用户</th><th>联系方式</th><th>状态</th><th>提交时间</th></tr></thead><tbody><tr v-for="item in feedback.items" :key="item.id"><td><div class="question-cell"><strong>{{ item.content }}</strong><small>{{ item.id }}</small></div></td><td>{{ item.category }}</td><td>{{ item.user.nickname || '未命名用户' }}</td><td>{{ item.contact || '—' }}</td><td><span class="status-badge" :class="item.status.toLowerCase()">{{ item.status }}</span></td><td>{{ formatDate(item.createdAt) }}</td></tr><tr v-if="!feedback.items.length"><td colspan="6" class="empty-row">{{ loading ? '正在加载…' : '暂无匹配反馈' }}</td></tr></tbody></table></div>
      <div class="pagination"><button :disabled="current().page <= 1" @click="load(current().page - 1)">上一页</button><span>第 {{ current().page }} 页</span><button :disabled="current().page * current().pageSize >= current().total" @click="load(current().page + 1)">下一页</button></div>
    </article>
  </section>
</template>
