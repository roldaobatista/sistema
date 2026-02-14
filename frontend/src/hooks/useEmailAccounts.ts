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

// ── Types ──────────────────────────────────

export interface EmailAccount {
    id: number
    tenant_id: number
    name: string
    email: string
    imap_host: string
    imap_port: number
    imap_encryption: string
    imap_username: string
    smtp_host: string | null
    smtp_port: number | null
    smtp_encryption: string | null
    is_active: boolean
    sync_status: 'idle' | 'syncing' | 'error'
    sync_error: string | null
    last_synced_at: string | null
}

export interface EmailAccountFormData {
    name: string
    email: string
    imap_host: string
    imap_port: number
    imap_encryption: string
    imap_username: string
    imap_password: string
    smtp_host?: string
    smtp_port?: number
    smtp_encryption?: string
    is_active?: boolean
}

// ── Queries ──────────────────────────────────

export function useEmailAccounts() {
    return useQuery<{ data: EmailAccount[] }>({
        queryKey: ['email-accounts'],
        queryFn: () => api.get('/email-accounts').then(r => r.data),
    })
}

export function useEmailAccount(id: number | null) {
    return useQuery<{ data: EmailAccount }>({
        queryKey: ['email-accounts', id],
        queryFn: () => api.get(`/email-accounts/${id}`).then(r => r.data),
        enabled: !!id,
    })
}

// ── Mutations ──────────────────────────────────

export function useCreateEmailAccount() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: EmailAccountFormData) =>
            api.post('/email-accounts', data).then(r => r.data),
        onSuccess: () => {
            toast.success('Conta de email criada com sucesso')
            qc.invalidateQueries({ queryKey: ['email-accounts'] })
        },
        onError: handleMutationError,
    })
}

export function useUpdateEmailAccount() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<EmailAccountFormData> }) =>
            api.put(`/email-accounts/${id}`, data).then(r => r.data),
        onSuccess: () => {
            toast.success('Conta de email atualizada')
            qc.invalidateQueries({ queryKey: ['email-accounts'] })
        },
        onError: handleMutationError,
    })
}

export function useDeleteEmailAccount() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: number) =>
            api.delete(`/email-accounts/${id}`).then(r => r.data),
        onSuccess: () => {
            toast.success('Conta de email removida')
            qc.invalidateQueries({ queryKey: ['email-accounts'] })
        },
        onError: handleMutationError,
    })
}

export function useSyncEmailAccount() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: number) =>
            api.post(`/email-accounts/${id}/sync`).then(r => r.data),
        onSuccess: () => {
            toast.success('Sincronização iniciada')
            qc.invalidateQueries({ queryKey: ['email-accounts'] })
        },
        onError: handleMutationError,
    })
}

export function useTestEmailConnection() {
    return useMutation({
        mutationFn: (id: number) =>
            api.post(`/email-accounts/${id}/test-connection`).then(r => r.data),
        onSuccess: (data) => {
            toast.success(data.message || 'Conexão bem-sucedida')
        },
        onError: handleMutationError,
    })
}
