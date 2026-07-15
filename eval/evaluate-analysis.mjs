import { readFile } from 'node:fs/promises'
import process from 'node:process'

const datasetPath = process.argv[2]
if (!datasetPath) {
  console.error('Usage: npm run evaluate:analysis -- <dataset.json>')
  process.exit(1)
}

const dataset = JSON.parse(await readFile(datasetPath, 'utf8'))
if (!Array.isArray(dataset) || dataset.length === 0)
  throw new Error('Evaluation dataset must be a non-empty JSON array')

const normalize = value => String(value ?? '').trim().toUpperCase()
const sameCodes = (expected, actual) => {
  const left = [...new Set(expected || [])].sort()
  const right = [...new Set(actual || [])].sort()
  return JSON.stringify(left) === JSON.stringify(right)
}
const percentile = (values, ratio) => {
  if (!values.length) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]
}

const result = dataset.reduce((summary, item) => {
  if (!item?.id || !item.expected || !item.actual)
    throw new Error('Each item requires id, expected and actual fields')
  summary.typeCorrect += item.expected.questionType === item.actual.questionType ? 1 : 0
  summary.answerCorrect += normalize(item.expected.correctAnswer) === normalize(item.actual.correctAnswer) ? 1 : 0
  summary.knowledgeCorrect += sameCodes(item.expected.knowledgePointCodes, item.actual.knowledgePointCodes) ? 1 : 0
  summary.durations.push(Number(item.actual.durationMs || 0))
  summary.cost += Number(item.actual.estimatedCost || 0)
  return summary
}, { typeCorrect: 0, answerCorrect: 0, knowledgeCorrect: 0, durations: [], cost: 0 })

const percent = value => Number((value / dataset.length * 100).toFixed(2))
console.log(JSON.stringify({
  samples: dataset.length,
  questionTypeAccuracy: percent(result.typeCorrect),
  answerAccuracy: percent(result.answerCorrect),
  knowledgePointExactMatch: percent(result.knowledgeCorrect),
  durationMsP50: percentile(result.durations, 0.5),
  durationMsP95: percentile(result.durations, 0.95),
  totalEstimatedCost: Number(result.cost.toFixed(4)),
  averageEstimatedCost: Number((result.cost / dataset.length).toFixed(4)),
}, null, 2))
