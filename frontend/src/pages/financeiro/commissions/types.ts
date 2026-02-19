// Commission module TypeScript interfaces

export interface CommissionRule {
    id: number
    tenant_id: number
    user_id: number | null
    name: string
    type: string
    applies_to_role: 'tecnico' | 'vendedor' | 'motorista'
    calculation_type: string
    value: number
    priority: number
    applies_to: 'all' | 'products' | 'services'
    applies_when: 'os_completed' | 'installment_paid' | 'os_invoiced'
    source_filter: string | null
    active: boolean
    user?: { id: number; name: string }
    created_at: string
    updated_at: string
}

export interface CommissionEvent {
    id: number
    tenant_id: number
    commission_rule_id: number
    work_order_id: number
    account_receivable_id: number | null
    user_id: number
    settlement_id: number | null
    base_amount: number
    commission_amount: number
    proportion: number
    status: 'pending' | 'approved' | 'paid' | 'reversed' | 'cancelled'
    notes: string | null
    created_at: string
    updated_at: string
    rule?: { id: number; name: string }
    work_order?: { id: number; os_number?: string; number?: string }
    user?: { id: number; name: string }
}

export interface CommissionSettlement {
    id: number
    tenant_id: number
    user_id: number
    period: string
    status: 'open' | 'closed' | 'approved' | 'rejected' | 'pending_approval' | 'paid'
    total_amount: number
    paid_amount: number | null
    balance: number | null
    events_count: number
    rejection_reason: string | null
    payment_notes: string | null
    paid_at: string | null
    user?: { id: number; name: string }
    created_at: string
    updated_at: string
}

export interface CommissionDispute {
    id: number
    commission_event_id: number
    user_id: number
    reason: string
    status: 'open' | 'accepted' | 'rejected'
    resolution_notes: string | null
    commission_amount: number | null
    user_name?: string
    user?: { id: number; name: string }
    commission_event?: { commission_amount: number }
    created_at: string
}

export interface CommissionGoal {
    id: number
    user_id: number
    user_name: string
    period: string
    type: 'revenue' | 'os_count' | 'new_clients'
    target_amount: number
    achieved_amount: number
    achievement_pct: number
    bonus_percentage: number | null
    bonus_amount: number | null
    notes: string | null
}

export interface CommissionCampaign {
    id: number
    name: string
    multiplier: number
    starts_at: string
    ends_at: string
    applies_to_role: string | null
    active: boolean
}

export interface RecurringCommission {
    id: number
    user_name: string
    rule_name: string
    rule_value: string
    contract_name: string | null
    recurring_contract_id: number
    status: 'active' | 'paused' | 'ended'
}

export interface SimulationResult {
    rule_id: number
    rule_name?: string
    rule?: { name: string }
    user_id: number
    user_name?: string
    user?: { name: string }
    calculation_type: string
    base_amount: number
    rate?: number
    fixed_amount?: number
    commission_amount: number
}

export interface BalanceSummary {
    total_earned: number
    total_paid: number
    balance: number
    pending_unsettled: number
}

export interface OverviewData {
    paid_this_month: number
    pending: number
    approved: number
    events_count: number
    variation_pct: number | null
}

export interface EvolutionData {
    period: string
    label?: string
    total: number
}

export interface RankingEntry {
    id: number
    name: string
    total: number
    events_count: number
    medal?: string
    position?: number
}

export interface ByRuleEntry {
    calculation_type: string
    count: number
    total: number
}

export interface ByRoleEntry {
    role: string
    count: number
    total: number
}

export interface UserOption {
    id: number
    name: string
}
