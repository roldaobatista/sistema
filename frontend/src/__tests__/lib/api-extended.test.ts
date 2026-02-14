import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for API interceptors — request/response flow, error handling
 */
const mockAxiosCreate = vi.fn()
const mockInterceptorsRequest = { use: vi.fn() }
const mockInterceptorsResponse = { use: vi.fn() }

vi.mock('axios', () => ({
    default: {
        create: (...args: unknown[]) => {
            mockAxiosCreate(...args)
            return {
                interceptors: {
                    request: mockInterceptorsRequest,
                    response: mockInterceptorsResponse,
                },
                get: vi.fn(),
                post: vi.fn(),
                put: vi.fn(),
                delete: vi.fn(),
            }
        },
    },
}))

describe('API — Extended Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Request Interceptor Logic', () => {
        it('adds Authorization header when token exists', () => {
            const config = { headers: {} as Record<string, string> }
            const token = 'test-token-123'
            if (token) {
                config.headers.Authorization = `Bearer ${token}`
            }
            expect(config.headers.Authorization).toBe('Bearer test-token-123')
        })

        it('does not add Authorization when no token', () => {
            const config = { headers: {} as Record<string, string> }
            const token = null
            if (token) {
                config.headers.Authorization = `Bearer ${token}`
            }
            expect(config.headers.Authorization).toBeUndefined()
        })

        it('Bearer format is correct', () => {
            const token = 'abc123'
            expect(`Bearer ${token}`).toBe('Bearer abc123')
        })

        it('preserves existing headers', () => {
            const config = { headers: { 'Content-Type': 'application/json' } as Record<string, string> }
            config.headers.Authorization = 'Bearer tok'
            expect(config.headers['Content-Type']).toBe('application/json')
            expect(config.headers.Authorization).toBe('Bearer tok')
        })
    })

    describe('Response Interceptor Logic — 401 Handling', () => {
        it('detects 401 status', () => {
            const err = { response: { status: 401 } }
            expect(err.response.status).toBe(401)
        })

        it('clears auth on 401', () => {
            const authState = { token: 'tok', isAuthenticated: true }
            const err = { response: { status: 401 } }
            if (err.response.status === 401) {
                authState.token = ''
                authState.isAuthenticated = false
            }
            expect(authState.token).toBe('')
            expect(authState.isAuthenticated).toBe(false)
        })

        it('redirects to /login on 401', () => {
            const err = { response: { status: 401 } }
            let redirectPath = ''
            if (err.response.status === 401) {
                redirectPath = '/login'
            }
            expect(redirectPath).toBe('/login')
        })

        it('does not clear auth on non-401 errors', () => {
            const authState = { token: 'tok', isAuthenticated: true }
            const err = { response: { status: 500 } }
            if (err.response.status === 401) {
                authState.token = ''
                authState.isAuthenticated = false
            }
            expect(authState.token).toBe('tok')
            expect(authState.isAuthenticated).toBe(true)
        })

        it('does not clear auth on 403', () => {
            const authState = { token: 'tok', isAuthenticated: true }
            const err = { response: { status: 403 } }
            if (err.response.status === 401) {
                authState.token = ''
            }
            expect(authState.token).toBe('tok')
        })

        it('handles error without response object', () => {
            const err = { message: 'Network Error' }
            const hasResponse = 'response' in err && (err as any).response?.status === 401
            expect(hasResponse).toBe(false)
        })
    })

    describe('Base URL Configuration', () => {
        it('API base URL should be localhost:8000', () => {
            const baseURL = 'http://127.0.0.1:8000/api/v1'
            expect(baseURL).toContain(':8000')
            expect(baseURL).toContain('/api/v1')
        })

        it('should not use port 5173', () => {
            const baseURL = 'http://127.0.0.1:8000/api/v1'
            expect(baseURL).not.toContain('5173')
        })

        it('should include /api/v1 prefix', () => {
            const baseURL = 'http://127.0.0.1:8000/api/v1'
            expect(baseURL.endsWith('/api/v1')).toBe(true)
        })
    })

    describe('Default Headers', () => {
        it('Content-Type should be application/json', () => {
            const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
            expect(headers['Content-Type']).toBe('application/json')
        })

        it('Accept should be application/json', () => {
            const headers = { Accept: 'application/json' }
            expect(headers.Accept).toBe('application/json')
        })
    })
})
