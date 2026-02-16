import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'

describe('Auth Store', () => {
    beforeEach(() => {
        localStorage.clear()
        // Reset Zustand store to initial state
        useAuthStore.setState({
            user: null,
            tenant: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
        })
    })

    describe('initial state', () => {
        it('should start with null user', () => {
            const state = useAuthStore.getState()
            expect(state.user).toBeNull()
        })

        it('should start unauthenticated', () => {
            const state = useAuthStore.getState()
            expect(state.isAuthenticated).toBe(false)
        })

        it('should start with no token', () => {
            const state = useAuthStore.getState()
            expect(state.token).toBeNull()
        })

        it('should start not loading', () => {
            const state = useAuthStore.getState()
            expect(state.isLoading).toBe(false)
        })
    })

    describe('hasPermission', () => {
        it('should return false when no user', () => {
            const result = useAuthStore.getState().hasPermission('admin.create')
            expect(result).toBe(false)
        })

        it('should return true when user has permission', () => {
            useAuthStore.setState({
                user: {
                    id: 1,
                    name: 'Test',
                    email: 'test@test.com',
                    phone: null,
                    tenant_id: 1,
                    permissions: ['admin.create', 'admin.read'],
                    roles: ['admin'],
                },
            })
            expect(useAuthStore.getState().hasPermission('admin.create')).toBe(true)
        })

        it('should return false when user lacks permission', () => {
            useAuthStore.setState({
                user: {
                    id: 1,
                    name: 'Test',
                    email: 'test@test.com',
                    phone: null,
                    tenant_id: 1,
                    permissions: ['admin.read'],
                    roles: ['admin'],
                },
            })
            expect(useAuthStore.getState().hasPermission('admin.delete')).toBe(false)
        })

        it('should fallback to all_permissions when permissions is not array', () => {
            useAuthStore.setState({
                user: {
                    id: 1,
                    name: 'Test',
                    email: 'test@test.com',
                    phone: null,
                    tenant_id: 1,
                    permissions: undefined as any,
                    all_permissions: ['workorder.create'],
                    roles: [],
                },
            })
            expect(useAuthStore.getState().hasPermission('workorder.create')).toBe(true)
        })
    })

    describe('hasRole', () => {
        it('should return false when no user', () => {
            expect(useAuthStore.getState().hasRole('admin')).toBe(false)
        })

        it('should return true when user has role', () => {
            useAuthStore.setState({
                user: {
                    id: 1,
                    name: 'Test',
                    email: 'test@test.com',
                    phone: null,
                    tenant_id: 1,
                    permissions: [],
                    roles: ['admin', 'manager'],
                },
            })
            expect(useAuthStore.getState().hasRole('admin')).toBe(true)
        })

        it('should return false for non-existent role', () => {
            useAuthStore.setState({
                user: {
                    id: 1,
                    name: 'Test',
                    email: 'test@test.com',
                    phone: null,
                    tenant_id: 1,
                    permissions: [],
                    roles: ['viewer'],
                },
            })
            expect(useAuthStore.getState().hasRole('admin')).toBe(false)
        })

        it('should fallback to all_roles when roles is not array', () => {
            useAuthStore.setState({
                user: {
                    id: 1,
                    name: 'Test',
                    email: 'test@test.com',
                    phone: null,
                    tenant_id: 1,
                    permissions: [],
                    roles: undefined as any,
                    all_roles: ['tech'],
                },
            })
            expect(useAuthStore.getState().hasRole('tech')).toBe(true)
        })
    })

    describe('setUser', () => {
        it('should set user with normalized permissions', () => {
            useAuthStore.getState().setUser({
                id: 1,
                name: 'New User',
                email: 'new@test.com',
                phone: '123',
                tenant_id: 1,
                permissions: ['a', 'b'],
                roles: ['admin'],
            })

            const user = useAuthStore.getState().user
            expect(user?.name).toBe('New User')
            expect(user?.permissions).toEqual(['a', 'b'])
            expect(user?.all_permissions).toEqual(['a', 'b'])
        })

        it('should normalize user with all_permissions array', () => {
            useAuthStore.getState().setUser({
                id: 2,
                name: 'API user',
                email: 'api@test.com',
                phone: null,
                tenant_id: 1,
                permissions: undefined as any,
                all_permissions: ['x', 'y'],
                roles: undefined as any,
                all_roles: ['role1'],
            })

            const user = useAuthStore.getState().user
            expect(user?.permissions).toEqual(['x', 'y'])
            expect(user?.roles).toEqual(['role1'])
        })
    })

    describe('persist partialize', () => {
        it('should persist token, isAuthenticated, user and tenant', () => {
            useAuthStore.setState({
                user: {
                    id: 1,
                    name: 'Test',
                    email: 'test@test.com',
                    phone: null,
                    tenant_id: 1,
                    permissions: ['a'],
                    roles: ['admin'],
                },
                token: 'abc123',
                isAuthenticated: true,
            })

            const stored = JSON.parse(localStorage.getItem('auth-store') || '{}')
            expect(stored.state?.token).toBe('abc123')
            expect(stored.state?.isAuthenticated).toBe(true)
            expect(stored.state?.user).toBeDefined()
            expect(stored.state?.user?.id).toBe(1)
        })
    })
})
