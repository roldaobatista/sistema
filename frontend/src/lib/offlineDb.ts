import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

/* ─── Schema ─────────────────────────────────────────────── */

export interface OfflineWorkOrder {
    id: number
    number: string
    os_number?: string | null
    status: string
    priority?: string | null
    scheduled_date?: string | null
    customer_id?: number | null
    customer_name?: string | null
    customer_phone?: string | null
    customer_address?: string | null
    city?: string | null
    description?: string | null
    sla_due_at?: string | null
    google_maps_link?: string | null
    waze_link?: string | null
    equipment_ids?: number[]
    technician_ids?: number[]
    updated_at: string
}

export interface OfflineEquipment {
    id: number
    work_order_id?: number | null
    customer_id?: number | null
    type?: string | null
    brand?: string | null
    model?: string | null
    serial_number?: string | null
    capacity?: string | null
    resolution?: string | null
    location?: string | null
    updated_at: string
}

export interface OfflineChecklist {
    id: number
    name: string
    service_type?: string | null
    items: Array<{
        id: number
        label: string
        type: 'boolean' | 'text' | 'number' | 'photo' | 'select'
        required: boolean
        options?: string[]
    }>
    updated_at: string
}

export interface OfflineChecklistResponse {
    id: string // ULID — gerado localmente quando offline
    work_order_id: number
    equipment_id: number
    checklist_id: number
    responses: Record<string, unknown>
    completed_at?: string | null
    synced: boolean
    updated_at: string
}

export interface OfflineStandardWeight {
    id: number
    code: string
    nominal_value: string
    precision_class?: string | null
    certificate_number?: string | null
    certificate_expiry?: string | null
    updated_at: string
}

export interface OfflineExpense {
    id: string // ULID local
    work_order_id: number
    category?: string | null
    description: string
    amount: string
    receipt_photo_id?: string | null // ref → photos store
    affects_technician_cash: boolean
    affects_net_value: boolean
    synced: boolean
    created_at: string
    updated_at: string
}

export interface OfflinePhoto {
    id: string // ULID local
    work_order_id: number
    entity_type: 'checklist' | 'expense' | 'general'
    entity_id?: string | null
    blob: Blob
    mime_type: string
    file_name: string
    synced: boolean
    created_at: string
}

export interface OfflineSignature {
    id: string // ULID local
    work_order_id: number
    signer_name: string
    png_base64: string
    captured_at: string
    synced: boolean
}

export interface OfflineMutation {
    id: string // ULID local
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    url: string
    body?: unknown
    headers?: Record<string, string>
    created_at: string
    retries: number
    last_error?: string | null
}

export interface SyncMeta {
    store: string
    last_synced_at: string
    last_pulled_at: string
    version: number
}

/* ─── DB Schema ──────────────────────────────────────────── */

interface KalibriumDB extends DBSchema {
    'work-orders': {
        key: number
        value: OfflineWorkOrder
        indexes: { 'by-status': string; 'by-updated': string }
    }
    'equipment': {
        key: number
        value: OfflineEquipment
        indexes: { 'by-work-order': number; 'by-customer': number }
    }
    'checklists': {
        key: number
        value: OfflineChecklist
    }
    'checklist-responses': {
        key: string
        value: OfflineChecklistResponse
        indexes: { 'by-work-order': number; 'by-synced': number }
    }
    'standard-weights': {
        key: number
        value: OfflineStandardWeight
    }
    'expenses': {
        key: string
        value: OfflineExpense
        indexes: { 'by-work-order': number; 'by-synced': number }
    }
    'photos': {
        key: string
        value: OfflinePhoto
        indexes: { 'by-work-order': number; 'by-synced': number; 'by-entity': string }
    }
    'signatures': {
        key: string
        value: OfflineSignature
        indexes: { 'by-work-order': number; 'by-synced': number }
    }
    'mutation-queue': {
        key: string
        value: OfflineMutation
        indexes: { 'by-created': string }
    }
    'sync-metadata': {
        key: string
        value: SyncMeta
    }
    'customer-capsules': {
        key: number
        value: {
            id: number
            data: any
            updated_at: string
        }
    }
}

/* ─── Database Singleton ─────────────────────────────────── */

const DB_NAME = 'kalibrium-offline'
const DB_VERSION = 2

let dbInstance: IDBPDatabase<KalibriumDB> | null = null

export async function getDb(): Promise<IDBPDatabase<KalibriumDB>> {
    if (dbInstance) return dbInstance

    dbInstance = await openDB<KalibriumDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Work Orders
            const woStore = db.createObjectStore('work-orders', { keyPath: 'id' })
            woStore.createIndex('by-status', 'status')
            woStore.createIndex('by-updated', 'updated_at')

            // Equipment
            const eqStore = db.createObjectStore('equipment', { keyPath: 'id' })
            eqStore.createIndex('by-work-order', 'work_order_id')
            eqStore.createIndex('by-customer', 'customer_id')

            // Checklists (templates)
            db.createObjectStore('checklists', { keyPath: 'id' })

            // Checklist responses (offline writes)
            const crStore = db.createObjectStore('checklist-responses', { keyPath: 'id' })
            crStore.createIndex('by-work-order', 'work_order_id')
            crStore.createIndex('by-synced', 'synced')

            // Standard weights (read-only cache)
            db.createObjectStore('standard-weights', { keyPath: 'id' })

            // Expenses (offline writes)
            const expStore = db.createObjectStore('expenses', { keyPath: 'id' })
            expStore.createIndex('by-work-order', 'work_order_id')
            expStore.createIndex('by-synced', 'synced')

            // Photos (offline blobs)
            const phStore = db.createObjectStore('photos', { keyPath: 'id' })
            phStore.createIndex('by-work-order', 'work_order_id')
            phStore.createIndex('by-synced', 'synced')
            phStore.createIndex('by-entity', 'entity_id')

            // Signatures
            const sigStore = db.createObjectStore('signatures', { keyPath: 'id' })
            sigStore.createIndex('by-work-order', 'work_order_id')
            sigStore.createIndex('by-synced', 'synced')

            // Mutation queue
            const mqStore = db.createObjectStore('mutation-queue', { keyPath: 'id' })
            mqStore.createIndex('by-created', 'created_at')

            // Sync metadata
            db.createObjectStore('sync-metadata', { keyPath: 'store' })

            // Customer Capsules (New in v2)
            db.createObjectStore('customer-capsules', { keyPath: 'id' })
        },
    })

    return dbInstance
}

/* ─── ULID Generator (lightweight, no deps) ──────────────── */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function generateUlid(): string {
    const now = Date.now()
    let timeStr = ''
    let t = now
    for (let i = 9; i >= 0; i--) {
        timeStr = ENCODING[t % 32] + timeStr
        t = Math.floor(t / 32)
    }

    let randomStr = ''
    for (let i = 0; i < 16; i++) {
        randomStr += ENCODING[Math.floor(Math.random() * 32)]
    }

    return timeStr + randomStr
}

/* ─── Convenience helpers ────────────────────────────────── */

type StoreNames =
    | 'work-orders'
    | 'equipment'
    | 'checklists'
    | 'checklist-responses'
    | 'standard-weights'
    | 'expenses'
    | 'photos'
    | 'signatures'
    | 'mutation-queue'
    | 'sync-metadata'
    | 'customer-capsules'

export async function clearStore(storeName: StoreNames): Promise<void> {
    const db = await getDb()
    await db.clear(storeName)
}

export async function getCount(storeName: StoreNames): Promise<number> {
    const db = await getDb()
    return db.count(storeName)
}

export async function getMutationQueueCount(): Promise<number> {
    return getCount('mutation-queue')
}

export async function enqueueMutation(
    method: OfflineMutation['method'],
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
): Promise<string> {
    const db = await getDb()
    const id = generateUlid()
    await db.put('mutation-queue', {
        id,
        method,
        url,
        body,
        headers,
        created_at: new Date().toISOString(),
        retries: 0,
        last_error: null,
    })
    return id
}

export async function dequeueMutation(id: string): Promise<void> {
    const db = await getDb()
    await db.delete('mutation-queue', id)
}

export async function getAllMutations(): Promise<OfflineMutation[]> {
    const db = await getDb()
    return db.getAllFromIndex('mutation-queue', 'by-created')
}
