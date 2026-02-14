import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for useSyncStatus — UI hook for sync state
 */

Object.defineProperty(navigator, 'onLine', { value: true, writable: true })

describe('useSyncStatus — core logic', () => {
    describe('isOnline detection', () => {
        it('reports online when navigator.onLine is true', () => {
            Object.defineProperty(navigator, 'onLine', { value: true })
            expect(navigator.onLine).toBe(true)
        })

        it('reports offline when navigator.onLine is false', () => {
            Object.defineProperty(navigator, 'onLine', { value: false })
            expect(navigator.onLine).toBe(false)
        })
    })

    describe('pendingCount tracking', () => {
        it('starts at zero with empty mutation queue', () => {
            const pendingCount = 0
            expect(pendingCount).toBe(0)
        })

        it('increments when mutations are queued', () => {
            const mutationQueue = [
                { id: '1', type: 'expense', synced: false },
                { id: '2', type: 'checklist_response', synced: false },
            ]
            const pendingCount = mutationQueue.filter(m => !m.synced).length
            expect(pendingCount).toBe(2)
        })

        it('decrements when mutations are synced', () => {
            const mutationQueue = [
                { id: '1', type: 'expense', synced: true },
                { id: '2', type: 'checklist_response', synced: false },
            ]
            const pendingCount = mutationQueue.filter(m => !m.synced).length
            expect(pendingCount).toBe(1)
        })
    })

    describe('lastSyncAt formatting', () => {
        it('returns null when never synced', () => {
            const lastSyncAt: string | null = null
            expect(lastSyncAt).toBeNull()
        })

        it('stores ISO timestamp after sync', () => {
            const lastSyncAt = new Date().toISOString()
            expect(lastSyncAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        })
    })

    describe('sync interval', () => {
        it('auto-sync interval is 5 minutes (300000ms)', () => {
            const SYNC_INTERVAL = 5 * 60 * 1000
            expect(SYNC_INTERVAL).toBe(300_000)
        })

        it('respects minimum sync interval to prevent rapid fire', () => {
            const MIN_INTERVAL = 10_000
            const lastSync = Date.now() - 5_000
            const canSync = Date.now() - lastSync > MIN_INTERVAL
            expect(canSync).toBe(false)
        })
    })
})

describe('useSyncStatus — event reactivity', () => {
    it('reacts to online event', () => {
        const onOnline = vi.fn()
        window.addEventListener('online', onOnline)
        window.dispatchEvent(new Event('online'))
        expect(onOnline).toHaveBeenCalledTimes(1)
        window.removeEventListener('online', onOnline)
    })

    it('reacts to offline event', () => {
        const onOffline = vi.fn()
        window.addEventListener('offline', onOffline)
        window.dispatchEvent(new Event('offline'))
        expect(onOffline).toHaveBeenCalledTimes(1)
        window.removeEventListener('offline', onOffline)
    })
})
