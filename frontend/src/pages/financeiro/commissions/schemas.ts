import { z } from 'zod'

// Commission Rule form validation
export const commissionRuleSchema = z.object({
    name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    calculation_type: z.string().min(1, 'Tipo de cálculo é obrigatório'),
    value: z.coerce.number().positive('Valor deve ser maior que 0'),
    applies_to_role: z.string().optional().nullable(),
    user_id: z.coerce.number().optional().nullable(),
    min_value: z.coerce.number().min(0).optional().nullable(),
    max_value: z.coerce.number().min(0).optional().nullable(),
    active: z.boolean().default(true),
}).refine(
    data => !data.min_value || !data.max_value || data.max_value >= data.min_value,
    { message: 'Valor máximo deve ser maior ou igual ao mínimo', path: ['max_value'] }
)

export type CommissionRuleFormData = z.infer<typeof commissionRuleSchema>

// Commission Goal form validation
export const commissionGoalSchema = z.object({
    user_id: z.coerce.number({ required_error: 'Selecione um usuário' }).positive('Selecione um usuário'),
    period: z.string().min(7, 'Período é obrigatório').regex(/^\d{4}-\d{2}$/, 'Formato: AAAA-MM'),
    target_amount: z.coerce.number().positive('Meta deve ser maior que 0'),
    type: z.enum(['revenue', 'os_count', 'new_clients'], { required_error: 'Selecione o tipo de meta' }),
    bonus_percentage: z.coerce.number().min(0).max(100).optional().nullable(),
    bonus_amount: z.coerce.number().min(0).optional().nullable(),
    notes: z.string().optional().nullable(),
})

export type CommissionGoalFormData = z.infer<typeof commissionGoalSchema>

// Commission Campaign form validation
export const commissionCampaignSchema = z.object({
    name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    multiplier: z.coerce.number().min(1.01, 'Multiplicador deve ser maior que 1').max(5, 'Multiplicador máximo é 5'),
    starts_at: z.string().min(1, 'Data de início é obrigatória'),
    ends_at: z.string().min(1, 'Data de fim é obrigatória'),
    applies_to_role: z.string().optional().nullable(),
}).refine(
    data => new Date(data.ends_at) >= new Date(data.starts_at),
    { message: 'Data de fim deve ser posterior ao início', path: ['ends_at'] }
)

export type CommissionCampaignFormData = z.infer<typeof commissionCampaignSchema>

// Commission Dispute form validation
export const commissionDisputeSchema = z.object({
    commission_event_id: z.coerce.number({ required_error: 'Selecione um evento' }).positive('Selecione um evento'),
    reason: z.string().min(10, 'Motivo deve ter pelo menos 10 caracteres'),
})

export type CommissionDisputeFormData = z.infer<typeof commissionDisputeSchema>

// Dispute resolution form validation
export const disputeResolutionSchema = z.object({
    status: z.enum(['accepted', 'rejected']),
    resolution_notes: z.string().min(5, 'Notas devem ter pelo menos 5 caracteres'),
    new_amount: z.coerce.number().min(0).optional().nullable(),
})

export type DisputeResolutionFormData = z.infer<typeof disputeResolutionSchema>

// Helper to extract field errors from ZodError
export function getFieldErrors(error: z.ZodError): Record<string, string> {
    const errors: Record<string, string> = {}
    for (const issue of error.issues) {
        const path = issue.path.join('.')
        if (!errors[path]) errors[path] = issue.message
    }
    return errors
}
