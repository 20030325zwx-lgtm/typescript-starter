export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface Overview {
  metrics: {
    usersTotal: number
    newUsersToday: number
    confirmedQuestions: number
    questionsToday: number
    analysisSuccessRate: number
    failedJobs: number
    pendingReviews: number
    completedReviewsToday: number
  }
  trend: Array<{ date: string, users: number, questions: number, analyses: number, reviews: number }>
  questionTypes: Array<{ name: string, count: number }>
  errorTypes: Array<{ name: string, count: number }>
  jobStatuses: Array<{ status: string, count: number }>
  updatedAt: string
}

export interface AdminUser {
  id: string
  nickname: string | null
  avatarUrl: string | null
  status: string
  createdAt: string
  updatedAt: string
  _count: { questions: number, reviewTasks: number, analysisJobs: number }
}

export interface AdminQuestion {
  id: string
  questionType: string | null
  questionText: string | null
  userAnswer: string | null
  correctAnswer: string | null
  status: string
  source: string | null
  createdAt: string
  user: { id: string, nickname: string | null }
  analyses: Array<{ errorType: string, confidence: number, needsManualReview: boolean }>
  knowledgePoints: Array<{ knowledgePoint: { code: string, name: string } }>
  reviewTasks: Array<{ dueAt: string, cycle: number }>
}

export interface AdminAnalysisJob {
  id: string
  questionId: string
  status: string
  retryCount: number
  errorCode: string | null
  errorMessageSafe: string | null
  workflowVersion: string
  queuedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  user: { id: string, nickname: string | null }
}

export interface AdminReview {
  id: string
  cycle: number
  dueAt: string
  status: string
  intervalDays: number
  completedAt: string | null
  createdAt: string
  user: { id: string, nickname: string | null }
  question: { id: string, questionType: string | null, questionText: string | null }
  attempt: { userAnswer: string | null, isCorrect: boolean | null, selfRating: string, durationSeconds: number | null } | null
}

export interface AdminFeedback {
  id: string
  category: string
  content: string
  contact: string | null
  status: string
  createdAt: string
  updatedAt: string
  user: { id: string, nickname: string | null }
}
