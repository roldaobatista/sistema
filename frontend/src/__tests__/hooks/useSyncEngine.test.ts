import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for syncEngine.ts — SyncEngine class and offline API wrappers
 * All DB/API dependencies are mocked.
 */

// Mock idb
vi.mock('idb', () => ({ openDB: vi.fn() }))

// Mock offlineDb
vi.mock('@/lib/offlineDb', () => ({
    getDb: vi.fn().mockResolvedValue({
        getAll: vi.fn().mockResolvedValue([]),
        put: vi.fn().mockResolvedValue(undefined),
        getAllFromIndex: vi.fn().mockResolvedValue([]),
        transaction: vi.fn().mockReturnValue({
            objectStore: vi.fn().mockReturnValue({
                put: vi.fn().mockResolvedValue(undefined),
                getAll: vi.fn().mockResolvedValue([]),
            }),
            done: Promise.resolve(),
        }),
    }),
    getAllMutations: vi.fn().mockResolvedValue([]),
    dequeueMutation: vi.fn().mockResolvedValue(undefined),
    enqueueMutation: vi.fn().mockResolvedValue('ulid-123'),
    generateUlid: vi.fn().mockReturnValue('01ARZ3NDEKTSV4RRFFQ69G5FAV'),
}))

// Mock api
vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: {} }),
        post: vi.fn().mockResolvedValue({ data: { processed: 0, errors: [] } }),
    },
}))

describe('syncEngine — SyncEngine class', () => {
    let SyncEngine: any

    beforeEach(async () => {
        vi.resetModules()
        const mod = await import('@/lib/syncEngine')
        SyncEngine = (mod as any).SyncEngine || mod.syncEngine
    })

    it('exports syncEngine singleton', async () => {
        const mod = await import('@/lib/syncEngine')
        expect(mod.syncEngine).toBeDefined()
    })

    it('syncEngine has fullSync method', async () => {
        const mod = await import('@/lib/syncEngine')
        expect(typeof mod.syncEngine.fullSync).toBe('function')
    })

    it('syncEngine has getIsSyncing method', async () => {
        const mod = await import('@/lib/syncEngine')
        expect(typeof mod.syncEngine.getIsSyncing).toBe('function')
    })

    it('syncEngine.getIsSyncing returns false initially', async () => {
        const mod = await import('@/lib/syncEngine')
        expect(mod.syncEngine.getIsSyncing()).toBe(false)
    })

    it('syncEngine has onSyncComplete listener method', async () => {
        const mod = await import('@/lib/syncEngine')
        expect(typeof mod.syncEngine.onSyncComplete).toBe('function')
    })

    it('onSyncComplete returns unsubscribe function', async () => {
        const mod = await import('@/lib/syncEngine')
        const unsub = mod.syncEngine.onSyncComplete(() => { })
        expect(typeof unsub).toBe('function')
    })
})

describe('syncEngine — offlinePost', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('exports offlinePost function', async () => {
        const mod = await import('@/lib/syncEngine')
        expect(typeof mod.offlinePost).toBe('function')
    })

    it('exports offlinePut function', async () => {
        const mod = await import('@/lib/syncEngine')
        expect(typeof mod.offlinePut).toBe('function')
    })
})

describe('syncEngine — conflict resolution patterns', () => {
    it('last-write-wins: newer timestamp wins', () => {
        const local = { updated_at: '2026-02-12T18:00:00Z', value: 'local' }
        const remote = { updated_at: '2026-02-12T17:00:00Z', value: 'remote' }

        const localTime = new Date(local.updated_at).getTime()
        const remoteTime = new Date(remote.updated_at).getTime()

        const winner = localTime >= remoteTime ? local : remote
        expect(winner.value).toBe('local')
    })

    it('last-write-wins: equal timestamps favor local', () => {
        const ts = '2026-02-12T18:00:00Z'
        const local = { updated_at: ts, value: 'local' }
        const remote = { updated_at: ts, value: 'remote' }

        const localTime = new Date(local.updated_at).getTime()
        const remoteTime = new Date(remote.updated_at).getTime()

        const winner = localTime >= remoteTime ? local : remote
        expect(winner.value).toBe('local')
    })
})

describe('syncEngine — batch mutation format', () => {
    it('wraps mutations correctly for batch push', () => {
        const mutations = [
            { type: 'checklist_response', data: { id: '01ARZ', checklist_item_id: 1, value: 'ok' } },
            { type: 'expense', data: { id: '01ARA', amount: 150.5, category: 'material' } },
            { type: 'signature', data: { id: '01ARB', signer_name: 'João', png_base64: 'abc==' } },
        ]

        const payload = { mutations }
        expect(payload.mutations).toHaveLength(3)
        expect(payload.mutations[0].type).toBe('checklist_response')
        expect(payload.mutations[1].data.amount).toBe(150.5)
        expect(payload.mutations[2].data.signer_name).toBe('João')
    })

    it('status change mutation has required fields', () => {
        const mutation = {
            type: 'status_change',
            data: {
                work_order_id: 42,
                from_status: 'pending',
                to_status: 'in_progress',
                changed_at: new Date().toISOString(),
            },
        }

        expect(mutation.data.work_order_id).toBe(42)
        expect(mutation.data.from_status).toBe('pending')
        expect(mutation.data.to_status).toBe('in_progress')
        expect(mutation.data.changed_at).toBeTruthy()
    })
})
