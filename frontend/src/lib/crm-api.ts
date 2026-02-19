import api from './api'

// ─── Types ──────────────────────────────────────────

export interface CrmPipelineStage {
    id: number
    pipeline_id: number
    name: string
    color: string | null
    sort_order: number
    probability: number
    is_won: boolean
    is_lost: boolean
    deals_count?: number
    deals_sum_value?: number
}

export interface CrmPipeline {
    id: number
    name: string
    slug: string
    color: string | null
    is_default: boolean
    is_active: boolean
    sort_order: number
    stages: CrmPipelineStage[]
}

export interface CrmDeal {
    id: number
    tenant_id: number
    customer_id: number
    pipeline_id: number
    stage_id: number
    title: string
    value: number
    probability: number
    expected_close_date: string | null
    source: string | null
    assigned_to: number | null
    quote_id: number | null
    work_order_id: number | null
    equipment_id: number | null
    status: 'open' | 'won' | 'lost'
    won_at: string | null
    lost_at: string | null
    lost_reason: string | null
    notes: string | null
    created_at: string
    updated_at: string
    customer?: { id: number; name: string; phone?: string; email?: string; health_score?: number }
    stage?: CrmPipelineStage
    pipeline?: { id: number; name: string }
    assignee?: { id: number; name: string }
    quote?: { id: number; quote_number: string; total: number; status: string }
    workOrder?: { id: number; number: string; os_number?: string | null; business_number?: string | null; status: string; total: number }
    equipment?: { id: number; code: string; brand: string; model: string }
    activities?: CrmActivity[]
}

export interface CrmActivity {
    id: number
    type: string
    customer_id: number
    deal_id: number | null
    user_id: number
    title: string
    description: string | null
    scheduled_at: string | null
    completed_at: string | null
    duration_minutes: number | null
    outcome: string | null
    channel: string | null
    is_automated: boolean
    metadata: Record<string, unknown> | null
    created_at: string
    customer?: { id: number; name: string }
    deal?: { id: number; title: string }
    user?: { id: number; name: string }
}

export interface CrmDashboardData {
    period?: {
        label: string
        start: string
        end: string
        period: 'month' | 'quarter' | 'year'
    }
    kpis: {
        open_deals: number
        won_month: number
        lost_month: number
        revenue_in_pipeline: number
        won_revenue: number
        avg_health_score: number
        no_contact_90d: number
        conversion_rate: number
    }
    previous_period?: {
        won_month: number
        lost_month: number
        won_revenue: number
        open_deals?: number
        revenue_in_pipeline?: number
        avg_health_score?: number
        no_contact_90d?: number
        conversion_rate?: number
    }
    email_tracking?: {
        total_sent: number
        opened: number
        clicked: number
        replied: number
        bounced: number
    }
    messaging_stats: {
        sent_month: number
        received_month: number
        whatsapp_sent: number
        email_sent: number
        delivered: number
        failed: number
        delivery_rate: number
    }
    pipelines: CrmPipeline[]
    recent_deals: CrmDeal[]
    upcoming_activities: CrmActivity[]
    top_customers: { customer_id: number; total_value: number; deal_count: number; customer?: { id: number; name: string } }[]
    calibration_alerts: { id: number; code: string; brand: string; model: string; customer_id: number; next_calibration_at: string; customer?: { id: number; name: string } }[]
}

export interface CrmConstants {
    deal_statuses: Record<string, { label: string; color: string }>
    deal_sources: Record<string, string>
    activity_types: Record<string, { label: string; icon: string }>
    activity_outcomes: Record<string, string>
    activity_channels: Record<string, string>
    customer_sources: Record<string, string>
    customer_segments: Record<string, string>
    customer_sizes: Record<string, string>
    customer_contract_types: Record<string, string>
    customer_ratings: Record<string, string>
}

// ─── API Functions ──────────────────────────────────

export const crmApi = {
    // Dashboard
    getDashboard: (params?: { period?: 'month' | 'quarter' | 'year'; period_ref?: string }) =>
        api.get<CrmDashboardData>('/crm/dashboard', { params }),

    // Constants
    getConstants: () => api.get<CrmConstants>('/crm/constants'),

    // Pipelines
    getPipelines: () => api.get<CrmPipeline[]>('/crm/pipelines'),
    createPipeline: (data: Partial<CrmPipeline> & { stages: Partial<CrmPipelineStage>[] }) =>
        api.post<CrmPipeline>('/crm/pipelines', data),
    updatePipeline: (id: number, data: Partial<CrmPipeline>) =>
        api.put<CrmPipeline>(`/crm/pipelines/${id}`, data),

    // Deals
    getDeals: (params?: Record<string, unknown>) =>
        api.get<{ data: CrmDeal[] }>('/crm/deals', { params }),
    getDeal: (id: number) => api.get<CrmDeal>(`/crm/deals/${id}`),
    createDeal: (data: Partial<CrmDeal>) => api.post<CrmDeal>('/crm/deals', data),
    updateDeal: (id: number, data: Partial<CrmDeal>) => api.put<CrmDeal>(`/crm/deals/${id}`, data),
    updateDealStage: (id: number, stageId: number) =>
        api.put<CrmDeal>(`/crm/deals/${id}/stage`, { stage_id: stageId }),
    markDealWon: (id: number) => api.put<CrmDeal>(`/crm/deals/${id}/won`),
    markDealLost: (id: number, reason?: string) =>
        api.put<CrmDeal>(`/crm/deals/${id}/lost`, { lost_reason: reason }),
    deleteDeal: (id: number) => api.delete(`/crm/deals/${id}`),
    dealsBulkUpdate: (data: { deal_ids: number[]; action: 'move_stage' | 'mark_won' | 'mark_lost' | 'delete'; stage_id?: number }) =>
        api.post<{ message: string; affected: number }>('/crm/deals/bulk-update', data),

    // Activities
    getActivities: (params?: Record<string, unknown>) =>
        api.get<{ data: CrmActivity[] }>('/crm/activities', { params }),
    createActivity: (data: Partial<CrmActivity>) =>
        api.post<CrmActivity>('/crm/activities', data),

    // Customer 360
    getCustomer360: (id: number) => api.get(`/crm/customer-360/${id}`),

    // Messages
    getMessages: (params?: Record<string, unknown>) =>
        api.get<{ data: CrmMessage[] }>('/crm/messages', { params }),
    sendMessage: (data: {
        customer_id: number
        channel: 'whatsapp' | 'email'
        body: string
        subject?: string
        deal_id?: number
        template_id?: number
        variables?: Record<string, string>
    }) => api.post<CrmMessage>('/crm/messages/send', data),

    // Message Templates
    getMessageTemplates: (channel?: string) =>
        api.get<CrmMessageTemplate[]>('/crm/message-templates', { params: channel ? { channel } : {} }),
    createMessageTemplate: (data: Partial<CrmMessageTemplate>) =>
        api.post<CrmMessageTemplate>('/crm/message-templates', data),
    updateMessageTemplate: (id: number, data: Partial<CrmMessageTemplate>) =>
        api.put<CrmMessageTemplate>(`/crm/message-templates/${id}`, data),
    deleteMessageTemplate: (id: number) =>
        api.delete(`/crm/message-templates/${id}`),
}

// ─── Message Types ──────────────────────────────────

export interface CrmMessage {
    id: number
    tenant_id: number
    customer_id: number
    deal_id: number | null
    user_id: number | null
    channel: 'whatsapp' | 'email' | 'sms'
    direction: 'inbound' | 'outbound'
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
    subject: string | null
    body: string
    from_address: string | null
    to_address: string | null
    external_id: string | null
    provider: string | null
    attachments: { name: string; url: string; mime: string }[] | null
    metadata: Record<string, unknown> | null
    sent_at: string | null
    delivered_at: string | null
    read_at: string | null
    failed_at: string | null
    error_message: string | null
    created_at: string
    customer?: { id: number; name: string }
    deal?: { id: number; title: string }
    user?: { id: number; name: string }
}

export interface CrmMessageTemplate {
    id: number
    name: string
    slug: string
    channel: 'whatsapp' | 'email' | 'sms'
    subject: string | null
    body: string
    variables: { name: string; description?: string }[] | null
    is_active: boolean
}
