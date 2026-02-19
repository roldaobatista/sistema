export interface ServiceCall {
    id: number
    call_number: string
    customer_id: number
    quote_id: number | null
    contract_id: number | null
    sla_policy_id: number | null
    template_id: number | null
    technician_id: number | null
    driver_id: number | null
    created_by: number | null
    status: ServiceCallStatus
    priority: ServiceCallPriority
    scheduled_date: string | null
    started_at: string | null
    completed_at: string | null
    latitude: number | null
    longitude: number | null
    address: string | null
    city: string | null
    state: string | null
    observations: string | null
    resolution_notes: string | null
    reschedule_count: number
    reschedule_reason: string | null
    reschedule_history: RescheduleEntry[] | null
    sla_breached: boolean
    sla_limit_hours: number
    sla_remaining_minutes: number | null
    response_time_minutes: number | null
    resolution_time_minutes: number | null
    equipments_count?: number
    created_at: string
    updated_at: string
    customer?: { id: number; name: string; phone?: string }
    technician?: { id: number; name: string }
    driver?: { id: number; name: string }
    createdBy?: { id: number; name: string }
    equipments?: Equipment[]
    comments?: ServiceCallComment[]
}

export interface RescheduleEntry {
    from: string | null
    to: string
    reason: string
    by: string
    at: string
}

export interface ServiceCallComment {
    id: number
    content: string
    user_id: number
    created_at: string
    user?: { id: number; name: string }
}

export interface ServiceCallTemplate {
    id: number
    name: string
    priority: ServiceCallPriority
    observations: string | null
    equipment_ids: number[] | null
    is_active: boolean
    created_at: string
}

export interface ServiceCallAssignee {
    id: number
    name: string
    email: string
}

export interface ServiceCallSummary {
    open: number
    scheduled: number
    in_transit: number
    in_progress: number
    completed_today: number
    sla_breached_active: number
}

export interface ServiceCallKpi {
    mttr_hours: number
    mt_triage_hours: number
    sla_breach_rate: number
    reschedule_rate: number
    total_period: number
    volume_by_day: { date: string; total: number }[]
    top_customers: { customer: string; total: number }[]
    by_technician: { technician: string; total: number }[]
}

export interface DuplicateCheckResult {
    has_duplicates: boolean
    duplicates: Pick<ServiceCall, 'id' | 'call_number' | 'status' | 'priority' | 'technician_id' | 'scheduled_date' | 'created_at'>[]
}

export interface Equipment {
    id: number
    tag?: string
    description?: string
    manufacturer?: string
    model?: string
    serial_number?: string
}

export type ServiceCallStatus = 'open' | 'scheduled' | 'in_transit' | 'in_progress' | 'completed' | 'cancelled'
export type ServiceCallPriority = 'low' | 'normal' | 'high' | 'urgent'

export const STATUS_LABELS: Record<ServiceCallStatus, string> = {
    open: 'Aberto',
    scheduled: 'Agendado',
    in_transit: 'Em Trânsito',
    in_progress: 'Em Atendimento',
    completed: 'Concluído',
    cancelled: 'Cancelado',
}

export const STATUS_COLORS: Record<ServiceCallStatus, string> = {
    open: '#3b82f6',
    scheduled: '#8b5cf6',
    in_transit: '#f59e0b',
    in_progress: '#ef4444',
    completed: '#22c55e',
    cancelled: '#6b7280',
}

export const PRIORITY_LABELS: Record<ServiceCallPriority, string> = {
    low: 'Baixa',
    normal: 'Normal',
    high: 'Alta',
    urgent: 'Urgente',
}

export const PRIORITY_COLORS: Record<ServiceCallPriority, string> = {
    low: '#6b7280',
    normal: '#3b82f6',
    high: '#f59e0b',
    urgent: '#ef4444',
}

export const STATUS_TRANSITIONS: Record<ServiceCallStatus, ServiceCallStatus[]> = {
    open: ['scheduled', 'cancelled'],
    scheduled: ['in_transit', 'open', 'cancelled'],
    in_transit: ['in_progress', 'scheduled', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: ['open'],
}
