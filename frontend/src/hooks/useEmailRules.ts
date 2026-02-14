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

export interface RuleCondition {
    field: 'from' | 'to' | 'subject' | 'body' | 'ai_category' | 'ai_priority' | 'ai_sentiment'
    operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex'
    value: string
}

export interface RuleAction {
    type: 'create_task' | 'create_chamado' | 'notify' | 'star' | 'archive' | 'mark_read' | 'assign_category'
    params?: Record<string, unknown>
}

export interface EmailRule {
    id: number
    tenant_id: number
    name: string
    description: string | null
    conditions: RuleCondition[]
    actions: RuleAction[]
    priority: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface EmailRuleFormData {
    name: string
    description?: string
    conditions: RuleCondition[]
    actions: RuleAction[]
    priority?: number
    is_active?: boolean
}

// ── Queries ──────────────────────────────────

export function useEmailRules() {
    return useQuery<{ data: EmailRule[] }>({
        queryKey: ['email-rules'],
        queryFn: () => api.get('/email-rules').then(r => r.data),
    })
}

export function useEmailRule(id: number | null) {
    return useQuery<{ data: EmailRule }>({
        queryKey: ['email-rules', id],
        queryFn: () => api.get(`/email-rules/${id}`).then(r => r.data),
        enabled: !!id,
    })
}

// ── Mutations ──────────────────────────────────

export function useCreateEmailRule() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: EmailRuleFormData) =>
            api.post('/email-rules', data).then(r => r.data),
        onSuccess: () => {
            toast.success('Regra de email criada')
            qc.invalidateQueries({ queryKey: ['email-rules'] })
        },
        onError: handleMutationError,
    })
}

export function useUpdateEmailRule() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<EmailRuleFormData> }) =>
            api.put(`/email-rules/${id}`, data).then(r => r.data),
        onSuccess: () => {
            toast.success('Regra atualizada')
            qc.invalidateQueries({ queryKey: ['email-rules'] })
        },
        onError: handleMutationError,
    })
}

export function useDeleteEmailRule() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: number) =>
            api.delete(`/email-rules/${id}`).then(r => r.data),
        onSuccess: () => {
            toast.success('Regra removida')
            qc.invalidateQueries({ queryKey: ['email-rules'] })
        },
        onError: handleMutationError,
    })
}

export function useToggleEmailRuleActive() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: number) =>
            api.post(`/email-rules/${id}/toggle-active`).then(r => r.data),
        onSuccess: (data) => {
            toast.success(data.message || 'Status atualizado')
            qc.invalidateQueries({ queryKey: ['email-rules'] })
        },
        onError: handleMutationError,
    })
}
