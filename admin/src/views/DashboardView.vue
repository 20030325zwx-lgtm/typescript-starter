<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { adminApi } from '../services/api'
import type { Overview } from '../types'

const data = ref<Overview | null>(null)
const loading = ref(true)
const error = ref('')

const metrics = computed(() => data.value ? [
  { label: '有效用户', value: data.value.metrics.usersTotal, foot: `今日新增 ${data.value.metrics.newUsersToday}`, tone: 'blue' },
  { label: '已确认错题', value: data.value.metrics.confirmedQuestions, foot: `今日录入 ${data.value.metrics.questionsToday}`, tone: 'green' },
  { label: 'AI 分析成功率', value: `${data.value.metrics.analysisSuccessRate}%`, foot: `${data.value.metrics.failedJobs} 个失败任务`, tone: 'cyan' },
  { label: '待复习任务', value: data.value.metrics.pendingReviews, foot: `今日完成 ${data.value.metrics.completedReviewsToday}`, tone: 'orange' },
] : [])

const maxTrend = computed(() => Math.max(1, ...((data.value?.trend || []).map(item => Math.max(item.questions, item.analyses, item.reviews)))))
const points = (key: 'questions' | 'analyses' | 'reviews') => (data.value?.trend || []).map((item, index, rows) => {
  const x = rows.length <= 1 ? 0 : (index / (rows.length - 1)) * 100
  const y = 92 - (item[key] / maxTrend.value) * 78
  return `${x},${y}`
}).join(' ')

async function load() {
  loading.value = true
  error.value = ''
  try { data.value = await adminApi.overview(14) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '数据加载失败' }
  finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <div v-if="loading" class="page-state"><span class="spinner" />正在读取业务数据</div>
  <div v-else-if="error" class="page-state error"><strong>数据加载失败</strong><span>{{ error }}</span><button @click="load">重新加载</button></div>
  <div v-else-if="data" class="dashboard-page">
    <section class="metric-grid">
      <article v-for="metric in metrics" :key="metric.label" class="metric-card" :class="metric.tone">
        <div class="metric-top"><span>{{ metric.label }}</span><i /></div>
        <strong>{{ metric.value }}</strong><p>{{ metric.foot }}</p>
      </article>
    </section>

    <section class="dashboard-grid wide-left">
      <article class="panel trend-panel">
        <div class="panel-heading"><div><h2>近 14 日业务趋势</h2><p>错题录入、AI 分析与完成复习</p></div><div class="legend"><span class="q">错题</span><span class="a">分析</span><span class="r">复习</span></div></div>
        <div class="trend-chart">
          <div class="grid-lines"><i v-for="n in 5" :key="n" /></div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline class="questions-line" :points="points('questions')" />
            <polyline class="analyses-line" :points="points('analyses')" />
            <polyline class="reviews-line" :points="points('reviews')" />
          </svg>
        </div>
        <div class="trend-labels"><span v-for="(item, index) in data.trend" v-show="index % 2 === 0 || index === data.trend.length - 1" :key="item.date">{{ item.date.slice(5) }}</span></div>
      </article>

      <article class="panel status-panel">
        <div class="panel-heading"><div><h2>AI 任务状态</h2><p>全量任务分布</p></div></div>
        <div class="status-list"><div v-for="item in data.jobStatuses" :key="item.status"><span class="status-dot" :class="item.status.toLowerCase()" /><div><strong>{{ item.status }}</strong><small>{{ item.count }} 个任务</small></div><b>{{ item.count }}</b></div></div>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel ranking-panel">
        <div class="panel-heading"><div><h2>题目类型分布</h2><p>已确认错题</p></div></div>
        <div v-if="data.questionTypes.length" class="bar-list"><div v-for="item in data.questionTypes" :key="item.name"><div><span>{{ item.name }}</span><strong>{{ item.count }}</strong></div><i><b :style="{ width: `${Math.max(8, item.count / data.questionTypes[0].count * 100)}%` }" /></i></div></div><div v-else class="empty-inline">暂无已确认错题</div>
      </article>
      <article class="panel ranking-panel">
        <div class="panel-heading"><div><h2>高频错误诊断</h2><p>AI 分析错误类型</p></div></div>
        <div v-if="data.errorTypes.length" class="bar-list orange"><div v-for="item in data.errorTypes" :key="item.name"><div><span>{{ item.name }}</span><strong>{{ item.count }}</strong></div><i><b :style="{ width: `${Math.max(8, item.count / data.errorTypes[0].count * 100)}%` }" /></i></div></div><div v-else class="empty-inline">暂无分析数据</div>
      </article>
    </section>
  </div>
</template>
