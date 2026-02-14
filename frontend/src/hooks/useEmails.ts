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

export interface EmailItem {
    id: number
    email_account_id: number
    message_id: string
    folder: string
    from_email: string
    from_name: string | null
    to_email: string
    subject: string
    snippet: string
    body_text: string | null
    body_html: string | null
    received_at: string
    is_read: boolean
    is_starred: boolean
    is_archived: boolean
    has_attachments: boolean
    direction: 'inbound' | 'outbound'
    status: string
    ai_category: string | null
    ai_priority: string | null
    ai_sentiment: string | null
    ai_summary: string | null
    ai_suggested_action: string | null
    ai_confidence: number | null
    customer_id: number | null
    linked_type: string | null
    linked_id: number | null
    account?: { id: number; name: string; email: string }
    customer?: { id: number; name: string }
    attachments?: { id: number; filename: string; mime_type: string; size_bytes: number }[]
}

export interface EmailFilters {
    folder?: string
    account_id?: number
    is_read?: boolean
    ai_category?: string
    ai_priority?: string
    customer_id?: number
    search?: string
    per_page?: number
    page?: number
}

export interface EmailStats {
    total: number
    unread: number
    starred: number
    today: number
    by_category: Record<string, number>
    by_priority: Record<string, number>
    by_sentiment: Record<string, number>
}

export interface ComposeData {
    account_id: number
    to: string
    subject: string
    body: string
    cc?: string
    bcc?: string
}

// ── Queries ──────────────────────────────────

export function useEmails(filters: EmailFilters = {}) {
    return useQuery({
        queryKey: ['emails', filters],
        queryFn: () => api.get('/emails', { params: filters }).then(r => r.data),
        staleTime: 30_000,
    })
}

export function useEmail(id: number | null) {
    return useQuery<{ data: EmailItem }>({
        queryKey: ['emails', id],
        queryFn: () => api.get(`/emails/${id}`).then(r => r.data),
        enabled: !!id,
    })
}

export function useEmailStats() {
    return useQuery<{ data: EmailStats }>({
        queryKey: ['emails', 'stats'],
        queryFn: () => api.get('/emails/stats').then(r => r.data),
        refetchInterval: 60_000,
    })
}

// ── Mutations ──────────────────────────────────

export function useToggleEmailStar() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (emailId: number) =>
            api.post(`/emails/${emailId}/toggle-star`).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['emails'] })
        },
        onError: handleMutationError,
    })
}

export function useMarkEmailRead() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (emailId: number) =>
            api.post(`/emails/${emailId}/mark-read`).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['emails'] })
        },
    })
}

export function useMarkEmailUnread() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (emailId: number) =>
            api.post(`/emails/${emailId}/mark-unread`).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['emails'] })
        },
        onError: handleMutationError,
    })
}

export function useArchiveEmail() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (emailId: number) =>
            api.post(`/emails/${emailId}/archive`).then(r => r.data),
        onSuccess: () => {
            toast.success('Email arquivado')
            qc.invalidateQueries({ queryKey: ['emails'] })
        },
        onError: handleMutationError,
    })
}

export function useComposeEmail() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: ComposeData) =>
            api.post('/emails/compose', data).then(r => r.data),
        onSuccess: () => {
            toast.success('Email enviado com sucesso')
            qc.invalidateQueries({ queryKey: ['emails'] })
        },
        onError: handleMutationError,
    })
}

export function useReplyEmail() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ emailId, data }: { emailId: number; data: { body: string; cc?: string; bcc?: string } }) =>
            api.post(`/emails/${emailId}/reply`, data).then(r => r.data),
        onSuccess: () => {
            toast.success('Resposta enviada')
            qc.invalidateQueries({ queryKey: ['emails'] })
        },
        onError: handleMutationError,
    })
}

export function useForwardEmail() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ emailId, data }: { emailId: number; data: { to: string; body?: string } }) =>
            api.post(`/emails/${emailId}/forward`, data).then(r => r.data),
        onSuccess: () => {
            toast.success('Email encaminhado')
            qc.invalidateQueries({ queryKey: ['emails'] })
        },
        onError: handleMutationError,
    })
}

export function useCreateTaskFromEmail() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ emailId, data }: { emailId: number; data: { type: string; title?: string; responsible_id?: number } }) =>
            api.post(`/emails/${emailId}/create-task`, data).then(r => r.data),
        onSuccess: (res) => {
            toast.success(res.message || 'Item criado a partir do email')
            qc.invalidateQueries({ queryKey: ['emails'] })
            qc.invalidateQueries({ queryKey: ['central-items'] })
        },
        onError: handleMutationError,
    })
}

export function useLinkEmailEntity() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ emailId, data }: { emailId: number; data: { linked_type: string; linked_id: number } }) =>
            api.post(`/emails/${emailId}/link-entity`, data).then(r => r.data),
        onSuccess: () => {
            toast.success('Email vinculado com sucesso')
            qc.invalidateQueries({ queryKey: ['emails'] })
        },
        onError: handleMutationError,
    })
}

export function useEmailBatchAction() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: { ids: number[]; action: string }) =>
            api.post('/emails/batch-action', data).then(r => r.data),
        onSuccess: () => {
            toast.success('Ação aplicada')
            qc.invalidateQueries({ queryKey: ['emails'] })
        },
        onError: handleMutationError,
    })
}
