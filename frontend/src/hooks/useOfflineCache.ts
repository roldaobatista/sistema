import { useState, useEffect, useCallback } from 'react'

interface CacheOptions {
    key: string
    maxAge?: number // ms, default 30 minutes
}

export function useOfflineCache<T>(
    fetchFn: () => Promise<T>,
    { key, maxAge = 30 * 60 * 1000 }: CacheOptions
) {
    const [data, setData] = useState<T | null>(() => {
        try {
            const cached = localStorage.getItem(`cache:${key}`)
            if (!cached) return null
            const { data, timestamp } = JSON.parse(cached)
            if (Date.now() - timestamp > maxAge) return null
            return data as T
        } catch { return null }
    })
    const [loading, setLoading] = useState(!data)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await fetchFn()
            setData(result)
            localStorage.setItem(`cache:${key}`, JSON.stringify({
                data: result,
                timestamp: Date.now(),
            }))
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
            // Keep showing cached data if available
        } finally {
            setLoading(false)
        }
    }, [fetchFn, key])

    useEffect(() => {
        refresh()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return { data, loading: loading && !data, error, refresh, isCached: !!data && loading }
}
