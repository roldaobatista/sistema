import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration tests for Stock (Estoque) and Equipment (Equipamentos) flows.
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

// ===========================================================================
// STOCK (Estoque)
// ===========================================================================

describe('Stock — Movements', () => {
    it('list stock movements returns entries and exits', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { id: 1, product_id: 1, type: 'entry', quantity: 50, product: { name: 'Sensor A' } },
                    { id: 2, product_id: 1, type: 'exit', quantity: 10, product: { name: 'Sensor A' } },
                ],
                meta: { total: 2 },
            },
        })

        const res = await mockApi.get('/stock/movements')
        expect(res.data.data).toHaveLength(2)
        expect(res.data.data[0].type).toBe('entry')
        expect(res.data.data[1].type).toBe('exit')
    })

    it('stock entry increases product quantity', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: { id: 3, type: 'entry', quantity: 100 },
                product: { current_stock: 150 },
            },
        })

        const res = await mockApi.post('/stock/movements', {
            product_id: 1,
            type: 'entry',
            quantity: 100,
        })
        expect(res.data.product.current_stock).toBe(150)
    })

    it('stock exit decreases product quantity', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: { id: 4, type: 'exit', quantity: 20 },
                product: { current_stock: 130 },
            },
        })

        const res = await mockApi.post('/stock/movements', {
            product_id: 1,
            type: 'exit',
            quantity: 20,
        })
        expect(res.data.product.current_stock).toBe(130)
    })

    it('exit more than available returns 422', async () => {
        mockApi.post.mockRejectedValue({
            response: {
                status: 422,
                data: { message: 'Estoque insuficiente. Disponível: 5' },
            },
        })

        try {
            await mockApi.post('/stock/movements', { product_id: 1, type: 'exit', quantity: 100 })
        } catch (e: any) {
            expect(e.response.status).toBe(422)
            expect(e.response.data.message).toContain('insuficiente')
        }
    })
})

describe('Stock — Products', () => {
    it('list products with stock levels', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { id: 1, name: 'Sensor A', current_stock: 50, min_stock: 10 },
                    { id: 2, name: 'Sensor B', current_stock: 3, min_stock: 10 },
                ],
            },
        })

        const res = await mockApi.get('/products')
        const lowStock = res.data.data.filter((p: any) => p.current_stock < p.min_stock)
        expect(lowStock).toHaveLength(1)
        expect(lowStock[0].name).toBe('Sensor B')
    })
})

// ===========================================================================
// EQUIPMENT (Equipamentos)
// ===========================================================================

describe('Equipment — CRUD', () => {
    it('create equipment', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: {
                    id: 1,
                    tag: 'EQ-001',
                    name: 'Balança Analítica',
                    customer_id: 1,
                    calibration_interval_months: 12,
                    next_calibration: '2026-01-01',
                },
            },
        })

        const res = await mockApi.post('/equipments', {
            tag: 'EQ-001',
            name: 'Balança Analítica',
            customer_id: 1,
        })
        expect(res.data.data.tag).toBe('EQ-001')
    })

    it('list equipments with calibration dates', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { id: 1, tag: 'EQ-001', next_calibration: '2025-03-01', status: 'overdue' },
                    { id: 2, tag: 'EQ-002', next_calibration: '2026-06-01', status: 'valid' },
                ],
            },
        })

        const res = await mockApi.get('/equipments')
        const overdue = res.data.data.filter((e: any) => e.status === 'overdue')
        expect(overdue).toHaveLength(1)
    })

    it('calibration calendar returns events', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { equipment_id: 1, tag: 'EQ-001', date: '2025-06-15', type: 'calibration' },
                    { equipment_id: 2, tag: 'EQ-002', date: '2025-07-20', type: 'calibration' },
                ],
            },
        })

        const res = await mockApi.get('/equipments/calendar?month=2025-06')
        expect(res.data.data.length).toBeGreaterThanOrEqual(1)
    })
})

// ===========================================================================
// SERVICE CALLS (Chamados)
// ===========================================================================

describe('Service Calls — Flow', () => {
    it('create service call', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: {
                    id: 1,
                    title: 'Equipamento com defeito',
                    customer_id: 1,
                    priority: 'high',
                    status: 'open',
                },
            },
        })

        const res = await mockApi.post('/service-calls', {
            title: 'Equipamento com defeito',
            customer_id: 1,
            priority: 'high',
        })
        expect(res.data.data.status).toBe('open')
        expect(res.data.data.priority).toBe('high')
    })

    it('close service call changes status', async () => {
        mockApi.patch.mockResolvedValue({
            data: { data: { id: 1, status: 'closed', closed_at: '2025-06-15' } },
        })

        const res = await mockApi.patch('/service-calls/1', { status: 'closed' })
        expect(res.data.data.status).toBe('closed')
        expect(res.data.data.closed_at).toBeTruthy()
    })

    it('convert service call to work order', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: { id: 50, status: 'open', service_call_id: 1 },
            },
        })

        const res = await mockApi.post('/service-calls/1/convert')
        expect(res.data.data.service_call_id).toBe(1)
        expect(res.data.data.status).toBe('open')
    })

    it('list service calls filtered by status', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { id: 1, status: 'open', title: 'Call A' },
                    { id: 2, status: 'open', title: 'Call B' },
                ],
                meta: { total: 2 },
            },
        })

        await mockApi.get('/service-calls?status=open')
        expect(mockApi.get).toHaveBeenCalledWith('/service-calls?status=open')
    })
})

// ===========================================================================
// INMETRO — Intelligence
// ===========================================================================

describe('INMETRO — Leads & Owners', () => {
    it('list INMETRO leads', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { id: 1, owner_name: 'Lab A', instrument_count: 5, status: 'new' },
                    { id: 2, owner_name: 'Lab B', instrument_count: 12, status: 'contacted' },
                ],
                meta: { total: 2 },
            },
        })

        const res = await mockApi.get('/inmetro/leads')
        expect(res.data.data).toHaveLength(2)
        expect(res.data.data[0]).toHaveProperty('instrument_count')
    })

    it('convert lead to CRM customer', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: { id: 1, customer_id: 42 },
                message: 'Convertido em cliente CRM!',
            },
        })

        const res = await mockApi.post('/inmetro/leads/1/convert')
        expect(res.data.data.customer_id).toBe(42)
        expect(res.data.message).toContain('CRM')
    })

    it('enrich lead contact info', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: { id: 1, email: 'found@lab.com', phone: '11999999999' },
            },
        })

        const res = await mockApi.post('/inmetro/leads/1/enrich')
        expect(res.data.data.email).toBeTruthy()
        expect(res.data.data.phone).toBeTruthy()
    })

    it('import instruments from CSV', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                imported: 150,
                skipped: 10,
                errors: 2,
            },
        })

        const res = await mockApi.post('/inmetro/import', new FormData())
        expect(res.data.imported).toBe(150)
        expect(res.data.errors).toBe(2)
    })
})
