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

/**
 * Extended constants tests — structure, values, exhaustiveness
 */
describe('DEAL_STATUS', () => {
    it('is a non-empty object', () => {
        expect(Object.keys(DEAL_STATUS).length).toBeGreaterThan(0)
    })
    it('has OPEN', () => { expect(DEAL_STATUS.OPEN).toBe('open') })
    it('has WON', () => { expect(DEAL_STATUS.WON).toBe('won') })
    it('has LOST', () => { expect(DEAL_STATUS.LOST).toBe('lost') })
    it('has exactly 3 keys', () => { expect(Object.keys(DEAL_STATUS)).toHaveLength(3) })
    it('all values are strings', () => {
        Object.values(DEAL_STATUS).forEach(v => expect(typeof v).toBe('string'))
    })
})

describe('QUOTE_STATUS', () => {
    it('is a non-empty object', () => { expect(Object.keys(QUOTE_STATUS).length).toBeGreaterThan(0) })
    it('has DRAFT', () => { expect(QUOTE_STATUS.DRAFT).toBe('draft') })
    it('has SENT', () => { expect(QUOTE_STATUS.SENT).toBe('sent') })
    it('has APPROVED', () => { expect(QUOTE_STATUS.APPROVED).toBe('approved') })
    it('has REJECTED', () => { expect(QUOTE_STATUS.REJECTED).toBe('rejected') })
    it('has EXPIRED', () => { expect(QUOTE_STATUS.EXPIRED).toBe('expired') })
    it('has INVOICED', () => { expect(QUOTE_STATUS.INVOICED).toBe('invoiced') })
    it('has exactly 6 keys', () => { expect(Object.keys(QUOTE_STATUS)).toHaveLength(6) })
    it('all values are strings', () => {
        Object.values(QUOTE_STATUS).forEach(v => expect(typeof v).toBe('string'))
    })
})

describe('WORK_ORDER_STATUS', () => {
    it('is a non-empty object', () => { expect(Object.keys(WORK_ORDER_STATUS).length).toBeGreaterThan(0) })
    it('has OPEN', () => { expect(WORK_ORDER_STATUS.OPEN).toBe('open') })
    it('has IN_PROGRESS', () => { expect(WORK_ORDER_STATUS.IN_PROGRESS).toBe('in_progress') })
    it('has COMPLETED', () => { expect(WORK_ORDER_STATUS.COMPLETED).toBe('completed') })
    it('has CANCELLED', () => { expect(WORK_ORDER_STATUS.CANCELLED).toBe('cancelled') })
    it('has INVOICED', () => { expect(WORK_ORDER_STATUS.INVOICED).toBe('invoiced') })
    it('has WAITING_PARTS', () => { expect(WORK_ORDER_STATUS.WAITING_PARTS).toBe('waiting_parts') })
    it('has WAITING_APPROVAL', () => { expect(WORK_ORDER_STATUS.WAITING_APPROVAL).toBe('waiting_approval') })
    it('has DELIVERED', () => { expect(WORK_ORDER_STATUS.DELIVERED).toBe('delivered') })
    it('has exactly 8 keys', () => { expect(Object.keys(WORK_ORDER_STATUS)).toHaveLength(8) })
    it('all values are strings', () => {
        Object.values(WORK_ORDER_STATUS).forEach(v => expect(typeof v).toBe('string'))
    })
    it('all values are unique', () => {
        const vals = Object.values(WORK_ORDER_STATUS)
        expect(new Set(vals).size).toBe(vals.length)
    })
})

describe('SERVICE_CALL_STATUS', () => {
    it('has OPEN', () => { expect(SERVICE_CALL_STATUS.OPEN).toBe('open') })
    it('has SCHEDULED', () => { expect(SERVICE_CALL_STATUS.SCHEDULED).toBe('scheduled') })
    it('has IN_TRANSIT', () => { expect(SERVICE_CALL_STATUS.IN_TRANSIT).toBe('in_transit') })
    it('has IN_PROGRESS', () => { expect(SERVICE_CALL_STATUS.IN_PROGRESS).toBe('in_progress') })
    it('has COMPLETED', () => { expect(SERVICE_CALL_STATUS.COMPLETED).toBe('completed') })
    it('has CANCELLED', () => { expect(SERVICE_CALL_STATUS.CANCELLED).toBe('cancelled') })
    it('has exactly 6 keys', () => { expect(Object.keys(SERVICE_CALL_STATUS)).toHaveLength(6) })
})

describe('FINANCIAL_STATUS', () => {
    it('has PENDING', () => { expect(FINANCIAL_STATUS.PENDING).toBe('pending') })
    it('has PARTIAL', () => { expect(FINANCIAL_STATUS.PARTIAL).toBe('partial') })
    it('has PAID', () => { expect(FINANCIAL_STATUS.PAID).toBe('paid') })
    it('has OVERDUE', () => { expect(FINANCIAL_STATUS.OVERDUE).toBe('overdue') })
    it('has CANCELLED', () => { expect(FINANCIAL_STATUS.CANCELLED).toBe('cancelled') })
    it('has exactly 5 keys', () => { expect(Object.keys(FINANCIAL_STATUS)).toHaveLength(5) })
})

describe('COMMISSION_STATUS', () => {
    it('has PENDING', () => { expect(COMMISSION_STATUS.PENDING).toBe('pending') })
    it('has APPROVED', () => { expect(COMMISSION_STATUS.APPROVED).toBe('approved') })
    it('has PAID', () => { expect(COMMISSION_STATUS.PAID).toBe('paid') })
    it('has REVERSED', () => { expect(COMMISSION_STATUS.REVERSED).toBe('reversed') })
    it('has REJECTED', () => { expect(COMMISSION_STATUS.REJECTED).toBe('rejected') })
    it('has OPEN', () => { expect(COMMISSION_STATUS.OPEN).toBe('open') })
    it('has ACCEPTED', () => { expect(COMMISSION_STATUS.ACCEPTED).toBe('accepted') })
    it('has CLOSED', () => { expect(COMMISSION_STATUS.CLOSED).toBe('closed') })
    it('has exactly 8 keys', () => { expect(Object.keys(COMMISSION_STATUS)).toHaveLength(8) })
    it('all values are strings', () => {
        Object.values(COMMISSION_STATUS).forEach(v => expect(typeof v).toBe('string'))
    })
})

describe('EXPENSE_STATUS', () => {
    it('has PENDING', () => { expect(EXPENSE_STATUS.PENDING).toBe('pending') })
    it('has APPROVED', () => { expect(EXPENSE_STATUS.APPROVED).toBe('approved') })
    it('has REJECTED', () => { expect(EXPENSE_STATUS.REJECTED).toBe('rejected') })
    it('has REIMBURSED', () => { expect(EXPENSE_STATUS.REIMBURSED).toBe('reimbursed') })
    it('has exactly 4 keys', () => { expect(Object.keys(EXPENSE_STATUS)).toHaveLength(4) })
})

describe('EQUIPMENT_STATUS', () => {
    it('has ACTIVE', () => { expect(EQUIPMENT_STATUS.ACTIVE).toBe('ativo') })
    it('has IN_CALIBRATION', () => { expect(EQUIPMENT_STATUS.IN_CALIBRATION).toBe('em_calibracao') })
    it('has IN_MAINTENANCE', () => { expect(EQUIPMENT_STATUS.IN_MAINTENANCE).toBe('em_manutencao') })
    it('has OUT_OF_SERVICE', () => { expect(EQUIPMENT_STATUS.OUT_OF_SERVICE).toBe('fora_de_uso') })
    it('has DISCARDED', () => { expect(EQUIPMENT_STATUS.DISCARDED).toBe('descartado') })
    it('has exactly 5 keys', () => { expect(Object.keys(EQUIPMENT_STATUS)).toHaveLength(5) })
})

describe('CENTRAL_ITEM_STATUS', () => {
    it('has OPEN', () => { expect(CENTRAL_ITEM_STATUS.OPEN).toBe('aberto') })
    it('has IN_PROGRESS', () => { expect(CENTRAL_ITEM_STATUS.IN_PROGRESS).toBe('em_andamento') })
    it('has COMPLETED', () => { expect(CENTRAL_ITEM_STATUS.COMPLETED).toBe('concluido') })
    it('has CANCELLED', () => { expect(CENTRAL_ITEM_STATUS.CANCELLED).toBe('cancelado') })
    it('has exactly 4 keys', () => { expect(Object.keys(CENTRAL_ITEM_STATUS)).toHaveLength(4) })
})

describe('IMPORT_ROW_STATUS', () => {
    it('has VALID', () => { expect(IMPORT_ROW_STATUS.VALID).toBe('valid') })
    it('has WARNING', () => { expect(IMPORT_ROW_STATUS.WARNING).toBe('warning') })
    it('has ERROR', () => { expect(IMPORT_ROW_STATUS.ERROR).toBe('error') })
    it('has exactly 3 keys', () => { expect(Object.keys(IMPORT_ROW_STATUS)).toHaveLength(3) })
})

describe('BANK_ENTRY_STATUS', () => {
    it('has PENDING', () => { expect(BANK_ENTRY_STATUS.PENDING).toBe('pending') })
    it('has MATCHED', () => { expect(BANK_ENTRY_STATUS.MATCHED).toBe('matched') })
    it('has IGNORED', () => { expect(BANK_ENTRY_STATUS.IGNORED).toBe('ignored') })
    it('has exactly 3 keys', () => { expect(Object.keys(BANK_ENTRY_STATUS)).toHaveLength(3) })
})

describe('MESSAGE_STATUS', () => {
    it('has PENDING', () => { expect(MESSAGE_STATUS.PENDING).toBe('pending') })
    it('has SENT', () => { expect(MESSAGE_STATUS.SENT).toBe('sent') })
    it('has DELIVERED', () => { expect(MESSAGE_STATUS.DELIVERED).toBe('delivered') })
    it('has READ', () => { expect(MESSAGE_STATUS.READ).toBe('read') })
    it('has FAILED', () => { expect(MESSAGE_STATUS.FAILED).toBe('failed') })
    it('has exactly 5 keys', () => { expect(Object.keys(MESSAGE_STATUS)).toHaveLength(5) })
})

describe('All Status Constants — Cross-cutting', () => {
    const allMaps = [
        { name: 'DEAL_STATUS', map: DEAL_STATUS },
        { name: 'QUOTE_STATUS', map: QUOTE_STATUS },
        { name: 'WORK_ORDER_STATUS', map: WORK_ORDER_STATUS },
        { name: 'SERVICE_CALL_STATUS', map: SERVICE_CALL_STATUS },
        { name: 'FINANCIAL_STATUS', map: FINANCIAL_STATUS },
        { name: 'COMMISSION_STATUS', map: COMMISSION_STATUS },
        { name: 'EXPENSE_STATUS', map: EXPENSE_STATUS },
        { name: 'EQUIPMENT_STATUS', map: EQUIPMENT_STATUS },
        { name: 'CENTRAL_ITEM_STATUS', map: CENTRAL_ITEM_STATUS },
        { name: 'IMPORT_ROW_STATUS', map: IMPORT_ROW_STATUS },
        { name: 'BANK_ENTRY_STATUS', map: BANK_ENTRY_STATUS },
        { name: 'MESSAGE_STATUS', map: MESSAGE_STATUS },
    ]

    allMaps.forEach(({ name, map }) => {
        it(`${name} all values are non-empty strings`, () => {
            Object.values(map).forEach(v => {
                expect(typeof v).toBe('string')
                expect((v as string).length).toBeGreaterThan(0)
            })
        })

        it(`${name} all keys are uppercase`, () => {
            Object.keys(map).forEach(k => {
                expect(k).toBe(k.toUpperCase())
            })
        })

        it(`${name} all values are unique`, () => {
            const vals = Object.values(map)
            expect(new Set(vals).size).toBe(vals.length)
        })
    })
})
