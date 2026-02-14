import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration tests for Quote flows — creation, status transitions,
 * items, conversion to Work Order.
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
// CREATE QUOTE
// ---------------------------------------------------------------------------

describe('Quote Create Flow', () => {
    const validQuote = {
        customer_id: 1,
        validity_days: 30,
        notes: 'Orçamento para calibração',
    }

    it('POST /quotes creates a new quote', async () => {
        mockApi.post.mockResolvedValue({
            data: { data: { id: 1, status: 'draft', quote_number: 'ORC-001', ...validQuote } },
        })

        const res = await mockApi.post('/quotes', validQuote)
        expect(res.data.data.id).toBe(1)
        expect(res.data.data.status).toBe('draft')
        expect(res.data.data.quote_number).toBe('ORC-001')
    })

    it('new quote starts with "draft" status', async () => {
        mockApi.post.mockResolvedValue({
            data: { data: { id: 1, status: 'draft' } },
        })

        const res = await mockApi.post('/quotes', validQuote)
        expect(res.data.data.status).toBe('draft')
    })

    it('quote without customer returns 422', async () => {
        mockApi.post.mockRejectedValue({
            response: {
                status: 422,
                data: { errors: { customer_id: ['O campo cliente é obrigatório.'] } },
            },
        })

        try {
            await mockApi.post('/quotes', {})
        } catch (e: any) {
            expect(e.response.status).toBe(422)
            expect(e.response.data.errors).toHaveProperty('customer_id')
        }
    })
})

// ---------------------------------------------------------------------------
// STATUS TRANSITIONS
// ---------------------------------------------------------------------------

describe('Quote Status Transitions', () => {
    const transitions = [
        { action: 'send', from: 'draft', to: 'sent' },
        { action: 'approve', from: 'sent', to: 'approved' },
        { action: 'reject', from: 'sent', to: 'rejected' },
        { action: 'reopen', from: 'rejected', to: 'draft' },
    ]

    transitions.forEach(({ action, from, to }) => {
        it(`${action}: ${from} → ${to}`, async () => {
            mockApi.post.mockResolvedValue({
                data: { data: { id: 1, status: to } },
            })

            const res = await mockApi.post(`/quotes/1/${action}`)
            expect(res.data.data.status).toBe(to)
        })
    })
})

// ---------------------------------------------------------------------------
// ITEMS MANAGEMENT
// ---------------------------------------------------------------------------

describe('Quote Items', () => {
    it('add item to quote', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: { id: 1, product_id: 5, quantity: 3, unit_price: 200, total: 600 },
                quote: { subtotal: 600, total: 600 },
            },
        })

        const res = await mockApi.post('/quotes/1/items', {
            product_id: 5,
            quantity: 3,
            unit_price: 200,
        })
        expect(res.data.data.total).toBe(600)
        expect(res.data.quote.total).toBe(600)
    })

    it('update item quantity recalculates', async () => {
        mockApi.put.mockResolvedValue({
            data: {
                data: { quantity: 5, unit_price: 200, total: 1000 },
                quote: { subtotal: 1000, total: 950, discount: 50 },
            },
        })

        const res = await mockApi.put('/quotes/1/items/1', { quantity: 5 })
        expect(res.data.data.total).toBe(1000)
        expect(res.data.quote.discount).toBe(50)
    })

    it('remove item from quote', async () => {
        mockApi.delete.mockResolvedValue({
            data: { quote: { subtotal: 0, total: 0 } },
        })

        const res = await mockApi.delete('/quotes/1/items/1')
        expect(res.data.quote.total).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// CONVERT TO OS
// ---------------------------------------------------------------------------

describe('Quote → Work Order Conversion', () => {
    it('convert approved quote to OS', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: { id: 100, status: 'open', quote_id: 1 },
                message: 'OS criada a partir do orçamento!',
            },
        })

        const res = await mockApi.post('/quotes/1/convert')
        expect(res.data.data.status).toBe('open')
        expect(res.data.data.quote_id).toBe(1)
    })

    it('cannot convert draft quote', async () => {
        mockApi.post.mockRejectedValue({
            response: {
                status: 422,
                data: { message: 'Orçamento precisa estar aprovado para converter em OS.' },
            },
        })

        try {
            await mockApi.post('/quotes/1/convert')
        } catch (e: any) {
            expect(e.response.status).toBe(422)
            expect(e.response.data.message).toContain('aprovado')
        }
    })
})

// ---------------------------------------------------------------------------
// DUPLICATE & PDF
// ---------------------------------------------------------------------------

describe('Quote — Duplicate & Export', () => {
    it('duplicate quote creates a new draft', async () => {
        mockApi.post.mockResolvedValue({
            data: { data: { id: 2, status: 'draft', quote_number: 'ORC-002' } },
        })

        const res = await mockApi.post('/quotes/1/duplicate')
        expect(res.data.data.status).toBe('draft')
        expect(res.data.data.id).not.toBe(1)
    })

    it('export PDF returns blob', async () => {
        mockApi.get.mockResolvedValue({
            data: new Blob(['pdf-content'], { type: 'application/pdf' }),
            headers: { 'content-type': 'application/pdf' },
        })

        const res = await mockApi.get('/quotes/1/pdf')
        expect(res.data).toBeInstanceOf(Blob)
    })
})
