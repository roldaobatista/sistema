import api from '@/lib/api'
import {
    getDb,
    getAllMutations,
    dequeueMutation,
    enqueueMutation,
    type OfflineWorkOrder,
    type OfflineEquipment,
    type OfflineChecklist,
    type OfflineStandardWeight,
    type OfflineChecklistResponse,
    type OfflineExpense,
    type OfflineSignature,
    type OfflinePhoto,
} from '@/lib/offlineDb'

/* ─── Types ──────────────────────────────────────────────── */

interface SyncPullResponse {
    work_orders: OfflineWorkOrder[]
    equipment: OfflineEquipment[]
    checklists: OfflineChecklist[]
    standard_weights: OfflineStandardWeight[]
    updated_at: string
}

interface SyncBatchItem {
    type: 'checklist_response' | 'expense' | 'signature' | 'status_change' | 'displacement_start' | 'displacement_arrive' | 'displacement_location' | 'displacement_stop'
    data: Record<string, unknown>
}

interface SyncBatchResponse {
    processed: number
    conflicts: Array<{ type: string; id: string; server_updated_at: string }>
    errors: Array<{ type: string; id: string; message: string }>
}

export interface SyncResult {
    pullCount: number
    pushCount: number
    errors: string[]
    timestamp: string
}

/* ─── Sync Engine ────────────────────────────────────────── */

class SyncEngine {
    private isSyncing = false
    private listeners: Array<(result: SyncResult) => void> = []

    onSyncComplete(listener: (result: SyncResult) => void) {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener)
        }
    }

    private emit(result: SyncResult) {
        this.listeners.forEach((l) => l(result))
    }

    async fullSync(): Promise<SyncResult> {
        if (this.isSyncing) {
            return { pullCount: 0, pushCount: 0, errors: ['Sync already in progress'], timestamp: new Date().toISOString() }
        }

        this.isSyncing = true
        const errors: string[] = []
        let pullCount = 0
        let pushCount = 0

        try {
            // 1. Push: send unsynced data first
            pushCount = await this.pushUnsyncedData(errors)

            // 2. Replay mutation queue
            const replayResult = await this.replayMutationQueue(errors)
            pushCount += replayResult

            // 3. Pull: fetch updated data from server
            pullCount = await this.pullData(errors)

        } catch (err) {
            errors.push(`Sync failed: ${(err as Error).message}`)
        } finally {
            this.isSyncing = false
        }

        const result: SyncResult = {
            pullCount,
            pushCount,
            errors,
            timestamp: new Date().toISOString(),
        }

        // Update sync metadata
        await this.updateSyncMeta(result.timestamp)

        this.emit(result)
        return result
    }

    async pullData(errors: string[]): Promise<number> {
        const db = await getDb()
        const meta = await db.get('sync-metadata', 'last-pull')
        const since = meta?.last_pulled_at || '1970-01-01T00:00:00Z'

        try {
            const { data } = await api.get<SyncPullResponse>('/tech/sync', {
                params: { since },
            })

            let count = 0

            // Upsert work orders
            if (data.work_orders?.length) {
                const tx = db.transaction('work-orders', 'readwrite')
                for (const wo of data.work_orders) {
                    tx.store.put(wo)
                }
                await tx.done
                count += data.work_orders.length
            }

            // Upsert equipment
            if (data.equipment?.length) {
                const tx = db.transaction('equipment', 'readwrite')
                for (const eq of data.equipment) {
                    tx.store.put(eq)
                }
                await tx.done
                count += data.equipment.length
            }

            // Upsert checklists
            if (data.checklists?.length) {
                const tx = db.transaction('checklists', 'readwrite')
                for (const cl of data.checklists) {
                    tx.store.put(cl)
                }
                await tx.done
                count += data.checklists.length
            }

            // Upsert standard weights
            if (data.standard_weights?.length) {
                const tx = db.transaction('standard-weights', 'readwrite')
                for (const sw of data.standard_weights) {
                    tx.store.put(sw)
                }
                await tx.done
                count += data.standard_weights.length
            }

            return count
        } catch (err) {
            errors.push(`Pull failed: ${(err as Error).message}`)
            return 0
        }
    }

    async pushUnsyncedData(errors: string[]): Promise<number> {
        const db = await getDb()
        let pushed = 0

        try {
            const batch: SyncBatchItem[] = []

            // Collect unsynced checklist responses
            const responses = await db.getAllFromIndex('checklist-responses', 'by-synced', 0) as OfflineChecklistResponse[]
            for (const r of responses) {
                batch.push({ type: 'checklist_response', data: r as unknown as Record<string, unknown> })
            }

            // Collect unsynced expenses
            const expenses = await db.getAllFromIndex('expenses', 'by-synced', 0) as OfflineExpense[]
            for (const e of expenses) {
                batch.push({ type: 'expense', data: e as unknown as Record<string, unknown> })
            }

            // Collect unsynced signatures
            const signatures = await db.getAllFromIndex('signatures', 'by-synced', 0) as OfflineSignature[]
            for (const s of signatures) {
                batch.push({ type: 'signature', data: s as unknown as Record<string, unknown> })
            }

            if (batch.length === 0) return 0

            const { data } = await api.post<SyncBatchResponse>('/tech/sync/batch', { mutations: batch })

            // Mark synced items
            if (data.processed > 0) {
                for (const r of responses) {
                    r.synced = true
                    await db.put('checklist-responses', r)
                }
                for (const e of expenses) {
                    e.synced = true
                    await db.put('expenses', e)
                }
                for (const s of signatures) {
                    s.synced = true
                    await db.put('signatures', s)
                }
            }

            // Handle conflicts
            for (const conflict of data.conflicts || []) {
                errors.push(`Conflito: ${conflict.type} #${conflict.id}`)
            }

            pushed = data.processed

            // Push photos separately (multipart)
            pushed += await this.pushPhotos(errors)

        } catch (err) {
            errors.push(`Push failed: ${(err as Error).message}`)
        }

        return pushed
    }

    private async pushPhotos(errors: string[]): Promise<number> {
        const db = await getDb()
        const photos = await db.getAllFromIndex('photos', 'by-synced', 0) as OfflinePhoto[]
        let pushed = 0

        for (const photo of photos) {
            try {
                const formData = new FormData()
                formData.append('file', photo.blob, photo.file_name)
                formData.append('work_order_id', String(photo.work_order_id))
                formData.append('entity_type', photo.entity_type)
                if (photo.entity_id) formData.append('entity_id', photo.entity_id)

                await api.post('/tech/sync/photo', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })

                photo.synced = true
                await db.put('photos', photo)
                pushed++
            } catch (err) {
                errors.push(`Photo upload failed: ${photo.file_name}`)
            }
        }

        return pushed
    }

    private async replayMutationQueue(errors: string[]): Promise<number> {
        const mutations = await getAllMutations()
        let replayed = 0

        for (const mutation of mutations) {
            if (mutation.retries >= 5) {
                errors.push(`Mutation ${mutation.id}: max retries exceeded`)
                continue
            }

            try {
                await api.request({
                    method: mutation.method,
                    url: mutation.url,
                    data: mutation.body,
                    headers: mutation.headers,
                })
                await dequeueMutation(mutation.id)
                replayed++
            } catch {
                // Will be retried next sync
            }
        }

        return replayed
    }

    private async updateSyncMeta(timestamp: string) {
        const db = await getDb()
        await db.put('sync-metadata', {
            store: 'last-pull',
            last_synced_at: timestamp,
            last_pulled_at: timestamp,
            version: 1,
        })
    }

    getIsSyncing() {
        return this.isSyncing
    }
}

/* ─── Singleton Export ────────────────────────────────────── */

export const syncEngine = new SyncEngine()

/* ─── Offline-aware API wrapper ──────────────────────────── */

export async function offlinePost(url: string, body: unknown): Promise<void> {
    if (navigator.onLine) {
        try {
            await api.post(url, body)
            return
        } catch (err) {
            if (err instanceof Error && !err.message?.includes('Network Error')) throw err
            // Fall through to offline queue
        }
    }

    // Queue for later
    await enqueueMutation('POST', `/api${url}`, body)

    // Request Background Sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = await navigator.serviceWorker.ready
        await (reg.sync as { register: (tag: string) => Promise<void> }).register('sync-mutations')
    }
}

export async function offlinePut(url: string, body: unknown): Promise<void> {
    if (navigator.onLine) {
        try {
            await api.put(url, body)
            return
        } catch (err) {
            if (err instanceof Error && !err.message?.includes('Network Error')) throw err
        }
    }

    await enqueueMutation('PUT', `/api${url}`, body)

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = await navigator.serviceWorker.ready
        await (reg.sync as { register: (tag: string) => Promise<void> }).register('sync-mutations')
    }
}
