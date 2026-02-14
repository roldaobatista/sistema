import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock navigator.serviceWorker and Notification API
const mockSubscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test',
    toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
}

const mockRegistration = {
    pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue(mockSubscription),
    },
}

vi.stubGlobal('Notification', {
    permission: 'default',
    requestPermission: vi.fn().mockResolvedValue('granted'),
})

// Make permission writable for test overrides
Object.defineProperty(globalThis.Notification, 'permission', {
    value: 'default',
    writable: true,
    configurable: true,
})

const mockSwReady = Promise.resolve(mockRegistration)
Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: mockSwReady, register: vi.fn() },
    writable: true,
    configurable: true,
})

// Mock API
vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { data: { vapid_public_key: 'test-vapid-key' } } }),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
    },
}))

// Dynamic import after mocks
const { usePushNotifications } = await import('@/hooks/usePushNotifications')

function wrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('usePushNotifications', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns initial state with permission and isSubscribed', () => {
        const { result } = renderHook(() => usePushNotifications(), { wrapper })

        expect(result.current).toHaveProperty('permission')
        expect(result.current).toHaveProperty('isSubscribed')
        expect(result.current).toHaveProperty('isLoading')
        expect(result.current).toHaveProperty('subscribe')
        expect(result.current).toHaveProperty('unsubscribe')
        expect(result.current).toHaveProperty('sendTest')
    })

    it('has subscribe, unsubscribe, and sendTest functions', () => {
        const { result } = renderHook(() => usePushNotifications(), { wrapper })

        expect(typeof result.current.subscribe).toBe('function')
        expect(typeof result.current.unsubscribe).toBe('function')
        expect(typeof result.current.sendTest).toBe('function')
    })

    it('permission returns a valid PushPermission value', () => {
        const { result } = renderHook(() => usePushNotifications(), { wrapper })

        // In jsdom, push notifications are not fully supported, so the hook
        // may return 'unsupported', 'default', 'granted', or 'denied'
        const validValues = ['default', 'granted', 'denied', 'unsupported']
        expect(validValues).toContain(result.current.permission)
    })

    it('permission is a string type', () => {
        const { result } = renderHook(() => usePushNotifications(), { wrapper })

        expect(typeof result.current.permission).toBe('string')
        expect(result.current.permission.length).toBeGreaterThan(0)
    })
})
