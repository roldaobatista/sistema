export interface ExpenseCategory {
    id: number
    name: string
    color: string
    active?: boolean
    budget_limit?: number | null
    default_affects_net_value?: boolean
    default_affects_technician_cash?: boolean
}

export interface ExpenseItem {
    id: number
    created_by?: number
    description: string
    amount: number | string
    expense_date: string
    status: ExpenseStatus
    payment_method?: string | null
    notes?: string | null
    receipt_path?: string | null
    expense_category_id?: number | null
    work_order_id?: number | null
    chart_of_account_id?: number | null
    chart_of_account?: { id: number; code: string; name: string; type: string } | null
    rejection_reason?: string | null
    affects_technician_cash?: boolean
    affects_net_value?: boolean
    km_quantity?: string | null
    km_rate?: string | null
    km_billed_to_client?: boolean
    category?: ExpenseCategory | null
    work_order?: ExpenseWorkOrder | null
    creator?: { id: number; name: string }
    approver?: { id: number; name: string } | null
    reviewer?: { id: number; name: string } | null
    reviewed_at?: string | null
    created_at?: string
    _warning?: string
    _budget_warning?: string
}

export interface ExpenseWorkOrder {
    id: number
    number: string
    os_number?: string | null
    business_number?: string | null
}

export type ExpenseStatus = 'pending' | 'reviewed' | 'approved' | 'rejected' | 'reimbursed'

export const EXPENSE_STATUS_MAP: Record<ExpenseStatus, { label: string; cls: string }> = {
    pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' },
    reviewed: { label: 'Conferida', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30' },
    approved: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' },
    rejected: { label: 'Rejeitada', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
    reimbursed: { label: 'Reembolsada', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

