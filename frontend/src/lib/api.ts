import axios from 'axios'
import { reportSuccess, reportFailure } from '@/lib/api-health'

const _viteApi = (import.meta.env.VITE_API_URL || '').trim()

// URL relativa quando VITE_API_URL vazio — funciona com IP ou domínio (mesma origem)
const api = axios.create({
    baseURL: _viteApi || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
})

// Interceptor: injeta token de auth
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Interceptor: trata erros de rede, 401/403 e alimenta circuit breaker
api.interceptors.response.use(
    (response) => {
        reportSuccess()
        return response
    },
    (error) => {
        const status = error.response?.status
        const isNetworkError = !error.response && (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED')
        const isBackendDown = status === 502 || status === 503 || status === 504

        if (isNetworkError || isBackendDown) {
            reportFailure()
        }

        if (status === 401) {
            localStorage.removeItem('auth_token')
            localStorage.removeItem('portal_token')
            // FIX-22: Limpar stores Zustand persistidos para evitar estado fantasma
            localStorage.removeItem('auth-store')
            localStorage.removeItem('portal-auth-store')
            window.location.href = '/login'
        }

        if (status === 403) {
            const message = error.response?.data?.message || 'Você não tem permissão para realizar esta ação.'
            window.dispatchEvent(new CustomEvent('api:forbidden', { detail: { message } }))
        }

        return Promise.reject(error)
    }
)

/** Origem da API (para URLs absolutas: storage, PDF, etc). Usa mesma origem quando VITE_API_URL vazio. */
export function getApiOrigin(): string {
    if (_viteApi) {
        const m = _viteApi.match(/^(https?:\/\/[^/]+)/)
        return m ? m[1] : (typeof window !== 'undefined' ? window.location.origin : '')
    }
    return typeof window !== 'undefined' ? window.location.origin : ''
}

export default api
