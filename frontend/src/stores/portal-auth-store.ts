import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'

interface PortalUser {
    id: number
    name: string
    email: string
    customer_id: number
    tenant_id: number
    customer: {
        id: number
        name: string
    }
}

interface PortalAuthState {
    user: PortalUser | null
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean

    login: (email: string, password: string, tenantId: number) => Promise<void>
    logout: () => Promise<void>
    fetchMe: () => Promise<void>
}

export const usePortalAuthStore = create<PortalAuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,

            login: async (email, password, tenantId) => {
                set({ isLoading: true })
                try {
                    const { data } = await api.post('/portal/login', { email, password, tenant_id: tenantId })
                    // FIX-19: Usar apenas portal_token, sem sobrescrever auth_token do admin
                    localStorage.setItem('portal_token', data.token)

                    set({
                        user: data.user,
                        token: data.token,
                        isAuthenticated: true,
                    })
                } catch (err: unknown) {
                    set({ isAuthenticated: false, user: null, token: null })
                    throw err
                } finally {
                    set({ isLoading: false })
                }
            },

            logout: async () => {
                try {
                    await api.post('/portal/logout')
                } catch {
                    // ignore
                } finally {
                    localStorage.removeItem('portal_token')
                    localStorage.removeItem('auth_token')
                    set({
                        user: null,
                        token: null,
                        isAuthenticated: false,
                    })
                }
            },

            fetchMe: async () => {
                try {
                    const { data } = await api.get('/portal/me')
                    set({
                        user: data,
                        isAuthenticated: true,
                    })
                } catch {
                    set({ isAuthenticated: false, user: null })
                    localStorage.removeItem('portal_token')
                    localStorage.removeItem('auth_token')
                }
            },
        }),
        {
            name: 'portal-auth-store',
            partialize: (state) => ({
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)
