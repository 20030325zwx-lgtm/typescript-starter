<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { adminApi } from '../services/api'
import type { AdminQuestion, PageResponse } from '../types'

const data = ref<PageResponse<AdminQuestion>>({ items: [], total: 0, page: 1, pageSize: 20 })
const filters = reactive({ search: '', status: '' })
const loading = ref(false)
const selected = ref<AdminQuestion | null>(null)
let timer: number | undefined
const statuses = ['DRAFT', 'ANALYSIS_PENDING', 'ANALYZING', 'ANALYSIS_FAILED', 'ANALYSIS_SUCCEEDED', 'CONFIRMED']

async function load(page = 1) { loading.value = true; try { data.value = await adminApi.questions({ ...filters, page, pageSize: 20 }) } finally { loading.value = false } }
function search() { window.clearTimeout(timer); timer = window.setTimeout(() => void load(), 300) }
function formatDate(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }) }
onMounted(load)
</script>

<template>
  <section class="data-page">
    <div class="toolbar"><div class="search-input"><span>⌕</span><input v-model="filters.search" placeholder="搜索题干、来源、用户或完整题目 ID" @input="search" /></div><select v-model="filters.status" @change="load()"><option value="">全部状态</option><option v-for="status in statuses" :key="status">{{ status }}</option></select><button class="refresh-button" @click="load(data.page)">刷新</button></div>
    <article class="table-panel">
      <div class="table-meta"><strong>错题列表</strong><span>共 {{ data.total }} 道题</span></div>
      <div class="table-scroll"><table><thead><tr><th>题目</th><th>用户</th><th>状态</th><th>AI 诊断</th><th>知识点</th><th>录入时间</th></tr></thead><tbody><tr v-for="item in data.items" :key="item.id" class="clickable" @click="selected = item"><td><div class="question-cell"><strong>{{ item.questionText || '题干待识别' }}</strong><small>{{ item.id }}</small></div></td><td>{{ item.user.nickname || '未命名用户' }}</td><td><span class="status-badge" :class="item.status.toLowerCase()">{{ item.status }}</span></td><td><template v-if="item.analyses[0]"><strong>{{ item.analyses[0].errorType }}</strong><small class="cell-sub">置信度 {{ Math.round(item.analyses[0].confidence * 100) }}%</small></template><span v-else>—</span></td><td><div class="tag-cell"><span v-for="point in item.knowledgePoints.slice(0, 2)" :key="point.knowledgePoint.code">{{ point.knowledgePoint.name }}</span></div></td><td>{{ formatDate(item.createdAt) }}</td></tr><tr v-if="!data.items.length"><td colspan="6" class="empty-row">{{ loading ? '正在加载…' : '暂无匹配错题' }}</td></tr></tbody></table></div>
      <div class="pagination"><button :disabled="data.page <= 1" @click="load(data.page - 1)">上一页</button><span>第 {{ data.page }} 页</span><button :disabled="data.page * data.pageSize >= data.total" @click="load(data.page + 1)">下一页</button></div>
    </article>

    <div v-if="selected" class="drawer-mask" @click.self="selected = null"><aside class="detail-drawer"><button class="drawer-close" @click="selected = null">×</button><div class="drawer-heading"><span class="status-badge" :class="selected.status.toLowerCase()">{{ selected.status }}</span><h2>错题详情</h2><p>{{ selected.id }}</p></div><dl><dt>题干</dt><dd>{{ selected.questionText || '尚未识别' }}</dd><dt>答案对比</dt><dd><span class="answer wrong">用户 {{ selected.userAnswer || '—' }}</span><span class="answer right">正确 {{ selected.correctAnswer || '—' }}</span></dd><dt>AI 诊断</dt><dd>{{ selected.analyses[0]?.errorType || '暂无分析' }}<small v-if="selected.analyses[0]">置信度 {{ Math.round(selected.analyses[0].confidence * 100) }}%</small></dd><dt>知识点</dt><dd class="drawer-tags"><span v-for="point in selected.knowledgePoints" :key="point.knowledgePoint.code">{{ point.knowledgePoint.name }}</span></dd><dt>下次复习</dt><dd>{{ selected.reviewTasks[0] ? formatDate(selected.reviewTasks[0].dueAt) : '暂无待复习任务' }}</dd></dl></aside></div>
  </section>
</template>
