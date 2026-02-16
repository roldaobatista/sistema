import { describe, it, expect } from 'vitest'
import {
    DEAL_STATUS,
    QUOTE_STATUS,
    WORK_ORDER_STATUS,
    SERVICE_CALL_STATUS,
    FINANCIAL_STATUS,
    COMMISSION_STATUS,
    EXPENSE_STATUS,
    EQUIPMENT_STATUS,
    CENTRAL_ITEM_STATUS,
    IMPORT_ROW_STATUS,
    BANK_ENTRY_STATUS,
    MESSAGE_STATUS,
} from '@/lib/constants'

describe('Status Constants', () => {
    it('DEAL_STATUS should have correct values', () => {
        expect(DEAL_STATUS.OPEN).toBe('open')
        expect(DEAL_STATUS.WON).toBe('won')
        expect(DEAL_STATUS.LOST).toBe('lost')
        expect(Object.keys(DEAL_STATUS)).toHaveLength(3)
    })

    it('QUOTE_STATUS should have all expected statuses', () => {
        const expected = ['DRAFT', 'PENDING_INTERNAL', 'INTERNALLY_APPROVED', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'INVOICED']
        expect(Object.keys(QUOTE_STATUS)).toEqual(expected)
        expect(QUOTE_STATUS.DRAFT).toBe('draft')
        expect(QUOTE_STATUS.PENDING_INTERNAL).toBe('pending_internal_approval')
        expect(QUOTE_STATUS.INTERNALLY_APPROVED).toBe('internally_approved')
        expect(QUOTE_STATUS.INVOICED).toBe('invoiced')
    })

    it('WORK_ORDER_STATUS should have all workflow states', () => {
        const keys = Object.keys(WORK_ORDER_STATUS)
        expect(keys).toContain('OPEN')
        expect(keys).toContain('IN_PROGRESS')
        expect(keys).toContain('COMPLETED')
        expect(keys).toContain('CANCELLED')
        expect(keys).toContain('INVOICED')
        expect(keys).toContain('WAITING_PARTS')
        expect(keys).toContain('WAITING_APPROVAL')
        expect(keys).toContain('DELIVERED')
        expect(keys).toHaveLength(8)
    })

    it('SERVICE_CALL_STATUS should have correct values', () => {
        expect(SERVICE_CALL_STATUS.OPEN).toBe('open')
        expect(SERVICE_CALL_STATUS.SCHEDULED).toBe('scheduled')
        expect(SERVICE_CALL_STATUS.IN_TRANSIT).toBe('in_transit')
        expect(SERVICE_CALL_STATUS.COMPLETED).toBe('completed')
        expect(Object.keys(SERVICE_CALL_STATUS)).toHaveLength(6)
    })

    it('FINANCIAL_STATUS should include all payment states', () => {
        expect(FINANCIAL_STATUS.PENDING).toBe('pending')
        expect(FINANCIAL_STATUS.PARTIAL).toBe('partial')
        expect(FINANCIAL_STATUS.PAID).toBe('paid')
        expect(FINANCIAL_STATUS.OVERDUE).toBe('overdue')
        expect(FINANCIAL_STATUS.CANCELLED).toBe('cancelled')
    })

    it('COMMISSION_STATUS should have all commission lifecycle states', () => {
        expect(Object.keys(COMMISSION_STATUS)).toHaveLength(8)
        expect(COMMISSION_STATUS.PENDING).toBe('pending')
        expect(COMMISSION_STATUS.REVERSED).toBe('reversed')
    })

    it('EXPENSE_STATUS should have correct values', () => {
        expect(Object.keys(EXPENSE_STATUS)).toHaveLength(5)
        expect(EXPENSE_STATUS.REVIEWED).toBe('reviewed')
        expect(EXPENSE_STATUS.REIMBURSED).toBe('reimbursed')
    })

    it('EQUIPMENT_STATUS should use Portuguese values', () => {
        expect(EQUIPMENT_STATUS.ACTIVE).toBe('ativo')
        expect(EQUIPMENT_STATUS.IN_CALIBRATION).toBe('em_calibracao')
        expect(EQUIPMENT_STATUS.DISCARDED).toBe('descartado')
    })

    it('CENTRAL_ITEM_STATUS should use Portuguese values', () => {
        expect(CENTRAL_ITEM_STATUS.OPEN).toBe('aberto')
        expect(CENTRAL_ITEM_STATUS.COMPLETED).toBe('concluido')
    })

    it('IMPORT_ROW_STATUS should have validation states', () => {
        expect(IMPORT_ROW_STATUS.VALID).toBe('valid')
        expect(IMPORT_ROW_STATUS.WARNING).toBe('warning')
        expect(IMPORT_ROW_STATUS.ERROR).toBe('error')
    })

    it('BANK_ENTRY_STATUS should have reconciliation states', () => {
        expect(Object.keys(BANK_ENTRY_STATUS)).toHaveLength(3)
        expect(BANK_ENTRY_STATUS.MATCHED).toBe('matched')
    })

    it('MESSAGE_STATUS should have delivery lifecycle states', () => {
        expect(Object.keys(MESSAGE_STATUS)).toHaveLength(5)
        expect(MESSAGE_STATUS.DELIVERED).toBe('delivered')
        expect(MESSAGE_STATUS.FAILED).toBe('failed')
    })
})
