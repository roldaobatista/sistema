// ─── Status Constants ─────────────────────────────────────
// Centralized status values to eliminate hardcoded strings.
// Must stay in sync with backend model constants.

export const DEAL_STATUS = {
    OPEN: 'open',
    WON: 'won',
    LOST: 'lost',
} as const;

export const QUOTE_STATUS = {
    DRAFT: 'draft',
    PENDING_INTERNAL: 'pending_internal_approval',
    INTERNALLY_APPROVED: 'internally_approved',
    SENT: 'sent',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    EXPIRED: 'expired',
    INVOICED: 'invoiced',
} as const;

export const WORK_ORDER_STATUS = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    INVOICED: 'invoiced',
    WAITING_PARTS: 'waiting_parts',
    WAITING_APPROVAL: 'waiting_approval',
    DELIVERED: 'delivered',
} as const;

export const SERVICE_CALL_STATUS = {
    OPEN: 'open',
    SCHEDULED: 'scheduled',
    IN_TRANSIT: 'in_transit',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
} as const;

export const FINANCIAL_STATUS = {
    PENDING: 'pending',
    PARTIAL: 'partial',
    PAID: 'paid',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled',
} as const;

export const COMMISSION_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    PAID: 'paid',
    REVERSED: 'reversed',
    REJECTED: 'rejected',
    OPEN: 'open',
    ACCEPTED: 'accepted',
    CLOSED: 'closed',
} as const;

export const EXPENSE_STATUS = {
    PENDING: 'pending',
    REVIEWED: 'reviewed',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    REIMBURSED: 'reimbursed',
} as const;

export const EQUIPMENT_STATUS = {
    ACTIVE: 'ativo',
    IN_CALIBRATION: 'em_calibracao',
    IN_MAINTENANCE: 'em_manutencao',
    OUT_OF_SERVICE: 'fora_de_uso',
    DISCARDED: 'descartado',
} as const;

export const CENTRAL_ITEM_STATUS = {
    OPEN: 'aberto',
    IN_PROGRESS: 'em_andamento',
    COMPLETED: 'concluido',
    CANCELLED: 'cancelado',
} as const;

export const IMPORT_ROW_STATUS = {
    VALID: 'valid',
    WARNING: 'warning',
    ERROR: 'error',
} as const;

export const BANK_ENTRY_STATUS = {
    PENDING: 'pending',
    MATCHED: 'matched',
    IGNORED: 'ignored',
} as const;

export const MESSAGE_STATUS = {
    PENDING: 'pending',
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read',
    FAILED: 'failed',
} as const;
