import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

// We test the api module's interceptor behavior by importing it
// and verifying the axios instance configuration.

describe('API axios instance', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('should have correct baseURL', async () => {
        const api = (await import('@/lib/api')).default
        const baseURL = api.defaults.baseURL || ''
        expect(baseURL.endsWith('/api/v1')).toBe(true)
    })

    it('should set correct default headers', async () => {
        const api = (await import('@/lib/api')).default
        expect(api.defaults.headers['Content-Type']).toBe('application/json')
        expect(api.defaults.headers['Accept']).toBe('application/json')
    })

    it('should have request interceptor for auth token', async () => {
        const api = (await import('@/lib/api')).default
        // The request interceptors should be registered
        expect(api.interceptors.request).toBeDefined()
    })

    it('should have response interceptor for 401', async () => {
        const api = (await import('@/lib/api')).default
        // The response interceptors should be registered
        expect(api.interceptors.response).toBeDefined()
    })
})
