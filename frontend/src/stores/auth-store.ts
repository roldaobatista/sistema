import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'

interface User {
    id: number
    name: string
    email: string
    tenant_id: number | null
    permissions: string[]
    roles: string[]
}

interface Tenant {
    id: number
    name: string
    document: string | null
    email: string | null
    phone: string | null
    status: string
}

interface AuthState {
    user: User | null
    tenant: Tenant | null
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean

    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    fetchMe: () => Promise<void>
    hasPermission: (permission: string) => boolean
    hasRole: (role: string) => boolean
    setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            tenant: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,

            login: async (email, password) => {
                set({ isLoading: true })
                try {
                    const { data } = await api.post('/login', { email, password })
                    localStorage.setItem('auth_token', data.token)
                    set({
                        user: data.user,
                        token: data.token,
                        isAuthenticated: true,
                    })
                    // Busca dados completos do usuário
                    await get().fetchMe()
                } finally {
                    set({ isLoading: false })
                }
            },

            logout: async () => {
                try {
                    await api.post('/logout')
                } catch {
                    // ignora erro de logout
                } finally {
                    localStorage.removeItem('auth_token')
                    set({
                        user: null,
                        tenant: null,
                        token: null,
                        isAuthenticated: false,
                    })
                }
            },

            fetchMe: async () => {
                try {
                    const { data } = await api.get('/me')
                    set({
                        user: data.user,
                        tenant: data.user.tenant,
                        isAuthenticated: true,
                    })
                } catch {
                    set({ isAuthenticated: false, user: null, tenant: null })
                }
            },

            hasPermission: (permission) => {
                return get().user?.permissions.includes(permission) ?? false
            },

            hasRole: (role) => {
                return get().user?.roles.includes(role) ?? false
            },

            setUser: (user) => set({ user }),
        }),
        {
            name: 'auth-store',
            partialize: (state) => ({
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)
