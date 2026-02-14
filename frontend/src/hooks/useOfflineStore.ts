import { useState, useEffect, useCallback, useRef } from 'react'
import { getDb, type OfflineWorkOrder, type OfflineEquipment, type OfflineChecklist, type OfflineChecklistResponse, type OfflineStandardWeight, type OfflineExpense, type OfflinePhoto, type OfflineSignature } from '@/lib/offlineDb'

/* ─── Store Type Map ─────────────────────────────────────── */

interface StoreTypeMap {
    'work-orders': OfflineWorkOrder
    equipment: OfflineEquipment
    checklists: OfflineChecklist
    'checklist-responses': OfflineChecklistResponse
    'standard-weights': OfflineStandardWeight
    expenses: OfflineExpense
    photos: OfflinePhoto
    signatures: OfflineSignature
    'customer-capsules': { id: number; data: any; updated_at: string }
}

type OfflineStoreName = keyof StoreTypeMap

/* ─── Hook ───────────────────────────────────────────────── */

export function useOfflineStore<K extends OfflineStoreName>(storeName: K) {
    type T = StoreTypeMap[K]
    const [items, setItems] = useState<T[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    const refresh = useCallback(async () => {
        setIsLoading(true)
        try {
            const db = await getDb()
            const all = await db.getAll(storeName) as T[]
            if (mountedRef.current) setItems(all)
        } catch (err) {
            console.error(`[OfflineStore] Failed to load ${storeName}:`, err)
        } finally {
            if (mountedRef.current) setIsLoading(false)
        }
    }, [storeName])

    useEffect(() => {
        refresh()
    }, [refresh])

    const getById = useCallback(async (id: IDBValidKey): Promise<T | undefined> => {
        const db = await getDb()
        return db.get(storeName as any, id as any) as Promise<T | undefined>
    }, [storeName])

    const put = useCallback(async (item: T): Promise<void> => {
        const db = await getDb()
        await db.put(storeName as any, item as any)
        await refresh()
    }, [storeName, refresh])

    const putMany = useCallback(async (newItems: T[]): Promise<void> => {
        const db = await getDb()
        const tx = db.transaction(storeName as any, 'readwrite')
        for (const item of newItems) {
            tx.store.put(item as any)
        }
        await tx.done
        await refresh()
    }, [storeName, refresh])

    const remove = useCallback(async (id: IDBValidKey): Promise<void> => {
        const db = await getDb()
        await db.delete(storeName as any, id as any)
        await refresh()
    }, [storeName, refresh])

    const clear = useCallback(async (): Promise<void> => {
        const db = await getDb()
        await db.clear(storeName as any)
        if (mountedRef.current) setItems([])
    }, [storeName])

    const count = useCallback(async (): Promise<number> => {
        const db = await getDb()
        return db.count(storeName as any)
    }, [storeName])

    const getByIndex = useCallback(async (
        indexName: string,
        value: IDBValidKey,
    ): Promise<T[]> => {
        const db = await getDb()
        return (db as any).getAllFromIndex(storeName, indexName, value) as Promise<T[]>
    }, [storeName])

    return {
        items,
        isLoading,
        refresh,
        getById,
        put,
        putMany,
        remove,
        clear,
        count,
        getByIndex,
    }
}

/* ─── Specialized: unsynced items ────────────────────────── */

export function useUnsyncedItems<K extends 'checklist-responses' | 'expenses' | 'photos' | 'signatures'>(storeName: K) {
    type T = StoreTypeMap[K]
    const [unsyncedItems, setUnsyncedItems] = useState<T[]>([])
    const [pendingCount, setPendingCount] = useState(0)

    const refresh = useCallback(async () => {
        const db = await getDb()
        // synced index stores boolean as 0/1 in IndexedDB
        const all = await (db as any).getAllFromIndex(storeName, 'by-synced', 0) as T[]
        setUnsyncedItems(all)
        setPendingCount(all.length)
    }, [storeName])

    useEffect(() => {
        refresh()
    }, [refresh])

    return { unsyncedItems, pendingCount, refresh }
}
