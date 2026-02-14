import { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useInmetroDashboard, useImportXml } from '@/hooks/useInmetro'
import { toast } from 'sonner'

const SYNC_COOLDOWN_KEY = 'inmetro_last_sync_attempt'
const COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

function isWithinCooldown(): boolean {
    const last = localStorage.getItem(SYNC_COOLDOWN_KEY)
    if (!last) return false
    return Date.now() - parseInt(last, 10) < COOLDOWN_MS
}

function markSyncAttempt() {
    localStorage.setItem(SYNC_COOLDOWN_KEY, String(Date.now()))
}

export function useInmetroAutoSync() {
    const queryClient = useQueryClient()
    const { data: dashboard, isLoading: isDashboardLoading } = useInmetroDashboard()
    const importXml = useImportXml()

    const [isSyncing, setIsSyncing] = useState(false)
    const [hasSynced, setHasSynced] = useState(false)
    const [syncError, setSyncError] = useState<string | null>(null)
    const autoSyncTriggered = useRef(false)

    const isEmpty = !isDashboardLoading && dashboard &&
        dashboard.totals.owners === 0 &&
        dashboard.totals.instruments === 0

    const triggerSync = useCallback(() => {
        if (isSyncing) return

        setIsSyncing(true)
        setSyncError(null)
        markSyncAttempt()

        importXml.mutate(
            { uf: 'MT', type: 'all' },
            {
                onSuccess: (res) => {
                    setIsSyncing(false)
                    setHasSynced(true)
                    queryClient.invalidateQueries({ queryKey: ['inmetro'] })

                    const results = res.data?.results
                    const msgs: string[] = []
                    if (results?.competitors?.stats) {
                        const s = results.competitors.stats
                        msgs.push(`Concorrentes: ${s.created} novos, ${s.updated} atualizados`)
                    }
                    if (results?.instruments?.stats) {
                        const s = results.instruments.stats
                        msgs.push(`Instrumentos: ${s.instruments_created} novos, Proprietários: ${s.owners_created} novos`)
                    }
                    toast.success(msgs.join(' | ') || 'Dados INMETRO atualizados!')
                },
                onError: (err: unknown) => {
                    setIsSyncing(false)
                    const message = (err as { response?: { data?: { error?: string } } })
                        ?.response?.data?.error || 'Erro ao buscar dados do INMETRO'
                    setSyncError(message)
                    toast.error(message)
                },
            }
        )
    }, [isSyncing, importXml, queryClient])

    // Auto-sync on first load if data is empty and not within cooldown
    useEffect(() => {
        if (isEmpty && !autoSyncTriggered.current && !isWithinCooldown()) {
            autoSyncTriggered.current = true
            triggerSync()
        }
    }, [isEmpty, triggerSync])

    return {
        isSyncing,
        hasSynced,
        syncError,
        isEmpty,
        isDashboardLoading,
        triggerSync,
    }
}
