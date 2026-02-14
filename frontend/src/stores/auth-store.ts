import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'

interface User {
    id: number
    name: string
    email: string
    phone: string | null
    tenant_id: number | null
    permissions: string[]
    roles: string[]
    all_permissions?: string[]
    all_roles?: string[]
    tenant?: Tenant | null
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

function normalizeUser(rawUser: any): User {
    const permissions = Array.isArray(rawUser?.permissions)
        ? rawUser.permissions
        : (Array.isArray(rawUser?.all_permissions) ? rawUser.all_permissions : [])

    const roles = Array.isArray(rawUser?.roles)
        ? rawUser.roles
        : (Array.isArray(rawUser?.all_roles) ? rawUser.all_roles : [])

    return {
        ...rawUser,
        permissions,
        roles,
        all_permissions: permissions,
        all_roles: roles,
    }
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
                    const user = normalizeUser(data.user)

                    localStorage.setItem('auth_token', data.token)
                    set({
                        user,
                        token: data.token,
                        isAuthenticated: true,
                    })

                    await get().fetchMe()
                } catch (err: any) {
                    set({ isAuthenticated: false, user: null, token: null })
                    if (err?.response?.status === 403) {
                        throw new Error(err.response?.data?.message ?? 'Conta desativada.')
                    }
                    throw err
                } finally {
                    set({ isLoading: false })
                }
            },

            logout: async () => {
                try {
                    await api.post('/logout')
                } catch (err) {
                    console.warn('Erro ao fazer logout (ignorado):', err)
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
                    const normalizedUser = normalizeUser(data.user)
                    const userData = {
                        ...normalizedUser,
                        tenant_id: normalizedUser.tenant?.id ?? normalizedUser.tenant_id ?? null,
                    }

                    set({
                        user: userData,
                        tenant: normalizedUser.tenant ?? null,
                        isAuthenticated: true,
                    })
                } catch (err) {
                    console.error('Erro ao buscar dados do usuario:', err)
                    set({ isAuthenticated: false, user: null, tenant: null })
                }
            },

            hasPermission: (permission) => {
                const user = get().user
                if (!user) return false

                const permissions = Array.isArray(user.permissions)
                    ? user.permissions
                    : (Array.isArray(user.all_permissions) ? user.all_permissions : [])

                return permissions.includes(permission)
            },

            hasRole: (role) => {
                const user = get().user
                if (!user) return false

                const roles = Array.isArray(user.roles)
                    ? user.roles
                    : (Array.isArray(user.all_roles) ? user.all_roles : [])

                return roles.includes(role)
            },

            setUser: (user) => set({ user: normalizeUser(user) }),
        }),
        {
            name: 'auth-store',
            partialize: (state) => ({
                token: state.token,
                isAuthenticated: state.isAuthenticated,
                user: state.user,
                tenant: state.tenant,
            }),
        }
    )
)
