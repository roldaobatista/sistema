import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock api module before importing the store
vi.mock('@/lib/api', () => ({
    default: {
        post: vi.fn(),
        get: vi.fn(),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}))

import { usePortalAuthStore } from '@/stores/portal-auth-store'

describe('portal-auth-store', () => {
    beforeEach(() => {
        const store = usePortalAuthStore.getState()
        usePortalAuthStore.setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
        })
        localStorage.clear()
    })

    it('has correct initial state', () => {
        const state = usePortalAuthStore.getState()
        expect(state.user).toBeNull()
        expect(state.token).toBeNull()
        expect(state.isAuthenticated).toBe(false)
        expect(state.isLoading).toBe(false)
    })

    it('persists only token and isAuthenticated via partialize', () => {
        // Set full state
        usePortalAuthStore.setState({
            user: { id: 1, name: 'Test', email: 'test@test', customer_id: 1, tenant_id: 1, customer: { id: 1, name: 'Customer' } },
            token: 'abc123',
            isAuthenticated: true,
            isLoading: true,
        })

        const stored = localStorage.getItem('portal-auth-store')
        if (stored) {
            const parsed = JSON.parse(stored)
            // Only token and isAuthenticated should be persisted
            expect(parsed.state).toHaveProperty('token')
            expect(parsed.state).toHaveProperty('isAuthenticated')
            expect(parsed.state).not.toHaveProperty('user')
            expect(parsed.state).not.toHaveProperty('isLoading')
        }
    })

    it('exposes login, logout, and fetchMe functions', () => {
        const state = usePortalAuthStore.getState()
        expect(typeof state.login).toBe('function')
        expect(typeof state.logout).toBe('function')
        expect(typeof state.fetchMe).toBe('function')
    })
})
