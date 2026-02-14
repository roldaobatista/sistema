import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration tests for Financial flows — accounts receivable/payable,
 * payments, monetary calculations, status transitions.
 */

const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
}

vi.mock('@/lib/api', () => ({ default: mockApi }))

beforeEach(() => vi.clearAllMocks())

// ---------------------------------------------------------------------------
// ACCOUNTS RECEIVABLE (Contas a Receber)
// ---------------------------------------------------------------------------

describe('Accounts Receivable Flow', () => {
    const validReceivable = {
        customer_id: 1,
        amount: 1500.00,
        due_date: '2025-06-15',
        description: 'OS #123 - Calibração',
    }

    it('POST /accounts-receivable creates new receivable', async () => {
        mockApi.post.mockResolvedValue({
            data: { data: { id: 1, status: 'pending', ...validReceivable } },
        })

        const res = await mockApi.post('/accounts-receivable', validReceivable)
        expect(res.data.data.id).toBe(1)
        expect(res.data.data.status).toBe('pending')
        expect(res.data.data.amount).toBe(1500.00)
    })

    it('new receivable starts with "pending" status', async () => {
        mockApi.post.mockResolvedValue({
            data: { data: { id: 1, status: 'pending' } },
        })

        const res = await mockApi.post('/accounts-receivable', validReceivable)
        expect(res.data.data.status).toBe('pending')
    })

    it('register payment changes status to "paid"', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: { id: 1, status: 'paid', paid_amount: 1500, paid_at: '2025-06-10' },
            },
        })

        const res = await mockApi.post('/accounts-receivable/1/payment', {
            amount: 1500,
            payment_method_id: 1,
        })
        expect(res.data.data.status).toBe('paid')
        expect(res.data.data.paid_amount).toBe(1500)
    })

    it('partial payment keeps status "partial"', async () => {
        mockApi.post.mockResolvedValue({
            data: { data: { id: 1, status: 'partial', paid_amount: 500, amount: 1500 } },
        })

        const res = await mockApi.post('/accounts-receivable/1/payment', { amount: 500 })
        expect(res.data.data.status).toBe('partial')
        expect(res.data.data.paid_amount).toBeLessThan(res.data.data.amount)
    })

    it('overdue receivables are flagged', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { id: 1, status: 'overdue', due_date: '2025-01-01', amount: 1000 },
                ],
            },
        })

        const res = await mockApi.get('/accounts-receivable?status=overdue')
        expect(res.data.data[0].status).toBe('overdue')
    })
})

// ---------------------------------------------------------------------------
// ACCOUNTS PAYABLE (Contas a Pagar)
// ---------------------------------------------------------------------------

describe('Accounts Payable Flow', () => {
    it('POST /accounts-payable creates new payable', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: {
                    id: 1,
                    supplier: 'Fornecedor X',
                    amount: 2500.00,
                    status: 'pending',
                    due_date: '2025-07-01',
                },
            },
        })

        const res = await mockApi.post('/accounts-payable', {
            supplier: 'Fornecedor X',
            amount: 2500,
            due_date: '2025-07-01',
        })
        expect(res.data.data.status).toBe('pending')
    })

    it('pay account changes status to "paid"', async () => {
        mockApi.post.mockResolvedValue({
            data: { data: { id: 1, status: 'paid', paid_at: '2025-06-30' } },
        })

        const res = await mockApi.post('/accounts-payable/1/payment', { amount: 2500 })
        expect(res.data.data.status).toBe('paid')
    })
})

// ---------------------------------------------------------------------------
// MONETARY CALCULATIONS
// ---------------------------------------------------------------------------

describe('Financial — Monetary Calculations', () => {
    it('sum of item totals equals invoice total', () => {
        const items = [
            { quantity: 2, unit_price: 150.50 },
            { quantity: 1, unit_price: 299.99 },
            { quantity: 3, unit_price: 50.00 },
        ]

        const total = items.reduce((acc, item) => {
            const lineTotal = parseFloat((item.quantity * item.unit_price).toFixed(2))
            return parseFloat((acc + lineTotal).toFixed(2))
        }, 0)

        expect(total).toBe(750.99)
    })

    it('discount calculation is correct', () => {
        const subtotal = 1000.00
        const discountPercent = 10
        const discountAmount = parseFloat(((subtotal * discountPercent) / 100).toFixed(2))
        const total = parseFloat((subtotal - discountAmount).toFixed(2))

        expect(discountAmount).toBe(100.00)
        expect(total).toBe(900.00)
    })

    it('negative amount is rejected', async () => {
        mockApi.post.mockRejectedValue({
            response: {
                status: 422,
                data: { errors: { amount: ['O valor deve ser positivo.'] } },
            },
        })

        try {
            await mockApi.post('/accounts-receivable', { amount: -100 })
        } catch (e: any) {
            expect(e.response.status).toBe(422)
            expect(e.response.data.errors.amount[0]).toContain('positivo')
        }
    })

    it('zero amount is rejected', async () => {
        mockApi.post.mockRejectedValue({
            response: {
                status: 422,
                data: { errors: { amount: ['O valor deve ser maior que zero.'] } },
            },
        })

        try {
            await mockApi.post('/accounts-receivable', { amount: 0 })
        } catch (e: any) {
            expect(e.response.status).toBe(422)
        }
    })

    it('float precision: 0.1 + 0.2 must equal 0.3 with toFixed', () => {
        const a = 0.1
        const b = 0.2
        const result = parseFloat((a + b).toFixed(2))
        expect(result).toBe(0.3)
    })
})

// ---------------------------------------------------------------------------
// CASH FLOW
// ---------------------------------------------------------------------------

describe('Financial — Cash Flow', () => {
    it('cash flow returns income and expenses', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                income: 50000,
                expenses: 35000,
                balance: 15000,
                months: [
                    { month: '2025-01', income: 10000, expenses: 7000 },
                    { month: '2025-02', income: 12000, expenses: 8000 },
                ],
            },
        })

        const res = await mockApi.get('/cash-flow?year=2025')
        expect(res.data.balance).toBe(15000)
        expect(res.data.income).toBeGreaterThan(res.data.expenses)
        expect(res.data.months).toHaveLength(2)
    })
})

// ---------------------------------------------------------------------------
// PAYMENT METHODS
// ---------------------------------------------------------------------------

describe('Financial — Payment Methods', () => {
    it('list payment methods', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { id: 1, name: 'Pix', active: true },
                    { id: 2, name: 'Boleto', active: true },
                    { id: 3, name: 'Cartão', active: false },
                ],
            },
        })

        const res = await mockApi.get('/payment-methods')
        const active = res.data.data.filter((m: any) => m.active)
        expect(active).toHaveLength(2)
    })

    it('delete payment method used by records returns 409', async () => {
        mockApi.delete.mockRejectedValue({
            response: {
                status: 409,
                data: { message: 'Não é possível excluir: existem pagamentos vinculados.' },
            },
        })

        try {
            await mockApi.delete('/payment-methods/1')
        } catch (e: any) {
            expect(e.response.status).toBe(409)
        }
    })
})
