import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import { AxiosError } from 'axios'

function handleMutationError(error: unknown) {
    const err = error as AxiosError<{ message?: string; errors?: Record<string, string[]> }>
    if (err.response?.status === 403) {
        toast.error('Sem permissão para esta ação')
    } else if (err.response?.status === 422) {
        const msgs = err.response.data?.errors
        if (msgs) {
            Object.values(msgs).flat().forEach(m => toast.error(m))
        } else {
            toast.error(err.response.data?.message || 'Dados inválidos')
        }
    } else {
        toast.error(err.response?.data?.message || 'Ocorreu um erro')
    }
}

export interface AuvoConnectionStatus {
    connected: boolean
    message: string
    available_entities?: Record<string, number>
}

export interface AuvoSyncStatus {
    entities: Record<string, {
        label: string
        last_import_at: string | null
        total_imported: number
        total_updated: number
        total_errors: number
        total_mapped: number
        status: string
    }>
    total_mappings: number
}

export interface AuvoPreview {
    entity: string
    total: number
    sample: Record<string, unknown>[]
    mapped_fields: string[]
}

export interface AuvoImportResult {
    import_id: number
    entity_type: string
    total_fetched: number
    inserted: number
    updated: number
    skipped: number
    errors: number
    error_details: string[]
    duration_seconds: number
    /** API pode retornar total_* em alguns endpoints */
    total_imported?: number
    total_updated?: number
    total_errors?: number
}

export interface AuvoImportHistory {
    data: {
        id: number
        entity_type: string
        status: string
        total_fetched: number
        total_imported: number
        total_updated: number
        total_skipped: number
        total_errors: number
        error_log: string[] | null
        started_at: string
        completed_at: string | null
        user_name: string
    }[]
    total: number
}

export interface AuvoMapping {
    id: number
    entity_type: string
    auvo_id: string
    kalibrium_id: number
    created_at: string
}

// ── Queries ──────────────────────────────────

export interface AuvoConfig {
    has_credentials: boolean
    api_key_masked: string
    api_token_masked: string
}

export function useAuvoGetConfig() {
    return useQuery<AuvoConfig>({
        queryKey: ['auvo', 'config'],
        queryFn: () => api.get('/auvo/config').then(r => r.data),
        staleTime: 60_000,
    })
}

export function useAuvoConnectionStatus() {
    return useQuery<AuvoConnectionStatus>({
        queryKey: ['auvo', 'status'],
        queryFn: () => api.get('/auvo/status').then(r => r.data),
        retry: 1,
        staleTime: 30_000,
    })
}

export function useAuvoSyncStatus() {
    return useQuery<AuvoSyncStatus>({
        queryKey: ['auvo', 'sync-status'],
        queryFn: () => api.get('/auvo/sync-status').then(r => r.data),
        refetchInterval: 10_000,
    })
}

export function useAuvoPreview(entity: string | null) {
    return useQuery<AuvoPreview>({
        queryKey: ['auvo', 'preview', entity],
        queryFn: () => api.get(`/auvo/preview/${entity}`).then(r => r.data),
        enabled: !!entity,
    })
}

export function useAuvoHistory(filters?: { entity?: string; status?: string; page?: number }) {
    const params = new URLSearchParams()
    if (filters?.entity) params.set('entity', filters.entity)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.page) params.set('page', String(filters.page))
    const qs = params.toString()
    return useQuery<AuvoImportHistory & { current_page?: number; last_page?: number }>({
        queryKey: ['auvo', 'history', qs],
        queryFn: () => api.get(`/auvo/history${qs ? `?${qs}` : ''}`).then(r => r.data),
    })
}

export function useAuvoMappings() {
    return useQuery<{ data: AuvoMapping[]; total: number }>({
        queryKey: ['auvo', 'mappings'],
        queryFn: () => api.get('/auvo/mappings').then(r => r.data),
    })
}

// ── Mutations ──────────────────────────────────

export function useAuvoImportEntity() {
    const qc = useQueryClient()
    return useMutation<AuvoImportResult, unknown, { entity: string; strategy?: string }>({
        mutationFn: ({ entity, strategy }) =>
            api.post(`/auvo/import/${entity}`, { strategy: strategy || 'skip' }).then(r => r.data),
        onSuccess: (data) => {
            const imported = data.total_imported ?? data.inserted ?? 0
            const updated = data.total_updated ?? data.updated ?? 0
            const fetched = data.total_fetched ?? 0
            const errCount = data.total_errors ?? data.errors ?? 0
            const msg = (data as { message?: string; entity_label?: string }).message
            const label = (data as { entity_label?: string }).entity_label || data.entity_type
            if (fetched === 0 && msg) {
                toast.warning(msg)
            } else {
                const parts = [`${label}: ${imported} importados`]
                if (updated > 0) parts.push(`${updated} atualizados`)
                if (errCount > 0) parts.push(`${errCount} erro(s)`)
                toast.success(parts.join(', '))
            }
            qc.invalidateQueries({ queryKey: ['auvo'] })
        },
        onError: handleMutationError,
    })
}

export function useAuvoImportAll() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (strategy?: string) =>
            api.post('/auvo/import-all', { strategy: strategy || 'skip' }).then(r => r.data),
        onSuccess: (data: { summary?: { total_inserted?: number; total_errors?: number }; message?: string }) => {
            const summary = data?.summary
            if (summary && (summary.total_inserted != null || summary.total_errors != null)) {
                const parts: string[] = []
                if (summary.total_inserted != null) parts.push(`${summary.total_inserted} importados`)
                if (summary.total_errors != null && summary.total_errors > 0) parts.push(`${summary.total_errors} erro(s)`)
                toast.success(parts.length ? parts.join(', ') : 'Importação em lote finalizada.')
            } else {
                toast.success(data?.message || 'Importação em lote finalizada.')
            }
            qc.invalidateQueries({ queryKey: ['auvo'] })
        },
        onError: handleMutationError,
    })
}

export function useAuvoRollback() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (importId: number) =>
            api.post(`/auvo/rollback/${importId}`).then(r => r.data),
        onSuccess: () => {
            toast.success('Importação desfeita com sucesso.')
            qc.invalidateQueries({ queryKey: ['auvo'] })
        },
        onError: handleMutationError,
    })
}

export function useAuvoConfig() {
    const qc = useQueryClient()
    return useMutation<{ message: string; saved: boolean; connected: boolean }, unknown, { api_key: string; api_token: string }>({
        mutationFn: (data: { api_key: string; api_token: string }) =>
            api.put('/auvo/config', data).then(r => r.data),
        onSuccess: (data) => {
            if (data.connected) {
                toast.success(data.message || 'Credenciais salvas e conexão verificada com sucesso.')
            } else {
                toast.warning(data.message || 'Credenciais salvas; verifique a conexão nas configurações.')
            }
            qc.invalidateQueries({ queryKey: ['auvo', 'status'] })
            qc.invalidateQueries({ queryKey: ['auvo', 'config'] })
        },
        onError: handleMutationError,
    })
}
