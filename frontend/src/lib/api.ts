import axios from 'axios'

const api = axios.create({
    baseURL: '/api/v1',
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

// Interceptor: trata 401 (token expirado)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('auth_token')
            localStorage.removeItem('portal_token')
            // FIX-22: Limpar stores Zustand persistidos para evitar estado fantasma
            localStorage.removeItem('auth-store')
            localStorage.removeItem('portal-auth-store')
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

export default api
