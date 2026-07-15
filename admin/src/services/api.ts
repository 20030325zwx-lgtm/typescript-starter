import type {
  AdminAnalysisJob,
  AdminFeedback,
  AdminQuestion,
  AdminReview,
  AdminUser,
  Overview,
  PageResponse,
} from '../types'

const TOKEN_KEY = 'learn-app-admin-token'
const USER_KEY = 'learn-app-admin-user'
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '')

interface ApiErrorBody { message?: string }

export class AdminApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export function hasAdminToken() {
  return Boolean(localStorage.getItem(TOKEN_KEY))
}

export function getAdminUsername() {
  return localStorage.getItem(USER_KEY) || '管理员'
}

export function logoutAdmin() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('content-type', 'application/json')
  const token = localStorage.getItem(TOKEN_KEY)
  if (token)
    headers.set('authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!response.ok) {
    let body: ApiErrorBody = {}
    try { body = await response.json() as ApiErrorBody } catch { /* empty */ }
    if (response.status === 401) {
      logoutAdmin()
      if (location.hash !== '#/login')
        location.hash = '#/login'
    }
    throw new AdminApiError(body.message || '请求失败，请稍后重试', response.status)
  }
  if (response.status === 204)
    return undefined as T
  return response.json() as Promise<T>
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '')
      search.set(key, String(value))
  })
  const value = search.toString()
  return value ? `?${value}` : ''
}

export async function loginAdmin(username: string, password: string) {
  const result = await request<{ accessToken: string, expiresIn: number, username: string }>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  localStorage.setItem(TOKEN_KEY, result.accessToken)
  localStorage.setItem(USER_KEY, result.username)
  return result
}

export const adminApi = {
  overview: (days = 14) => request<Overview>(`/admin/overview?days=${days}`),
  users: (params: Record<string, string | number | undefined>) => request<PageResponse<AdminUser>>(`/admin/users${query(params)}`),
  questions: (params: Record<string, string | number | undefined>) => request<PageResponse<AdminQuestion>>(`/admin/questions${query(params)}`),
  analysisJobs: (params: Record<string, string | number | undefined>) => request<PageResponse<AdminAnalysisJob>>(`/admin/analysis-jobs${query(params)}`),
  reviews: (params: Record<string, string | number | undefined>) => request<PageResponse<AdminReview>>(`/admin/reviews${query(params)}`),
  feedback: (params: Record<string, string | number | undefined>) => request<PageResponse<AdminFeedback>>(`/admin/feedback${query(params)}`),
}
