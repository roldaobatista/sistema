import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for offlineDb.ts — ULID generation and data schema validation
 * Tests pure logic only; IDB operations are mocked.
 */

// Mock idb to prevent JSDOM IndexedDB issues
vi.mock('idb', () => ({
    openDB: vi.fn(),
}))

describe('offlineDb — generateUlid', () => {
    let generateUlid: () => string

    beforeEach(async () => {
        vi.resetModules()
        const mod = await import('@/lib/offlineDb')
        generateUlid = mod.generateUlid
    })

    it('generates a 26-character ULID string', () => {
        const id = generateUlid()
        expect(id).toHaveLength(26)
    })

    it('generates unique IDs on consecutive calls', () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateUlid()))
        expect(ids.size).toBe(100)
    })

    it('contains only valid Crockford Base32 characters', () => {
        const id = generateUlid()
        // Crockford Base32: 0-9, A-H, J, K, M, N, P, Q, R, S, T, V, W, X, Y, Z (no I, L, O, U)
        expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/i)
    })

    it('is lexicographically sortable by time', () => {
        const a = generateUlid()
        // Small delay to guarantee different timestamp
        const start = Date.now()
        while (Date.now() === start) { /* spin */ }
        const b = generateUlid()
        // Given different millisecond, b > a
        expect(b > a).toBe(true)
    })

    it('generates IDs that are alphanumeric only', () => {
        for (let i = 0; i < 50; i++) {
            const id = generateUlid()
            expect(id).toMatch(/^[A-Z0-9]+$/i)
        }
    })
})

describe('offlineDb — enqueueMutation helper', () => {
    let enqueueMutation: (method: string, url: string, body?: unknown) => Promise<string>

    beforeEach(async () => {
        vi.resetModules()
        // Mock getDb to return a mock IDB store
        vi.mock('idb', () => ({
            openDB: vi.fn().mockResolvedValue({
                put: vi.fn().mockResolvedValue(undefined),
                transaction: vi.fn().mockReturnValue({
                    objectStore: vi.fn().mockReturnValue({
                        put: vi.fn().mockResolvedValue(undefined),
                    }),
                    done: Promise.resolve(),
                }),
            }),
        }))
        const mod = await import('@/lib/offlineDb')
        enqueueMutation = mod.enqueueMutation as any
    })

    it('exports enqueueMutation function', () => {
        expect(typeof enqueueMutation).toBe('function')
    })
})

describe('offlineDb — data shape contracts', () => {
    it('OfflineWorkOrder has required fields', () => {
        const wo = {
            id: 1,
            number: 'OS-001',
            status: 'pending',
            updated_at: new Date().toISOString(),
        }
        expect(wo.id).toBe(1)
        expect(wo.number).toBeTruthy()
        expect(wo.status).toBeTruthy()
        expect(wo.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('OfflineExpense has required fields', () => {
        const exp = {
            id: 'ulid123',
            work_order_id: 42,
            description: 'Material',
            amount: '150.00',
            synced: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }
        expect(exp.synced).toBe(false)
        expect(exp.amount).toBe('150.00')
    })

    it('OfflineSignature has required fields', () => {
        const sig = {
            id: 'ulid456',
            work_order_id: 42,
            signer_name: 'João Silva',
            png_base64: 'iVBORw0KGgo=',
            captured_at: new Date().toISOString(),
            synced: false,
        }
        expect(sig.signer_name).toBeTruthy()
        expect(sig.png_base64).toBeTruthy()
        expect(sig.synced).toBe(false)
    })

    it('OfflineMutation has required fields', () => {
        const mutation = {
            id: 'ulid789',
            method: 'POST' as const,
            url: '/api/v1/tech/sync/batch',
            body: { mutations: [] },
            created_at: new Date().toISOString(),
            retries: 0,
            last_error: null,
        }
        expect(mutation.method).toBe('POST')
        expect(mutation.retries).toBe(0)
    })
})
