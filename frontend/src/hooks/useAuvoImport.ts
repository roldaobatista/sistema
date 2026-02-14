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
        last_import_at: string | null
        total_imported: number
        total_errors: number
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
    api_key: string
    api_token: string
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

export function useAuvoHistory() {
    return useQuery<AuvoImportHistory>({
        queryKey: ['auvo', 'history'],
        queryFn: () => api.get('/auvo/history').then(r => r.data),
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
            toast.success(`${data.entity_type}: ${data.inserted} importados, ${data.updated} atualizados`)
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
        onSuccess: () => {
            toast.success('Importação completa finalizada')
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
            toast.success('Rollback executado com sucesso')
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
                toast.success(data.message || 'Credenciais salvas e conexão verificada')
            } else {
                toast.warning(data.message || 'Credenciais salvas, mas a conexão não foi verificada')
            }
            qc.invalidateQueries({ queryKey: ['auvo', 'status'] })
        },
        onError: handleMutationError,
    })
}
