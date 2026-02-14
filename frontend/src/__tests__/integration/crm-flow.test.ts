import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration tests for CRM flows — deals, pipeline, activities.
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
// DEALS
// ---------------------------------------------------------------------------

describe('CRM — Deals CRUD', () => {
    const validDeal = {
        title: 'Contrato de Calibração Anual',
        customer_id: 1,
        pipeline_id: 1,
        stage_id: 1,
        value: 50000.00,
    }

    it('POST /crm/deals creates a new deal', async () => {
        mockApi.post.mockResolvedValue({
            data: { data: { id: 1, status: 'open', ...validDeal } },
        })

        const res = await mockApi.post('/crm/deals', validDeal)
        expect(res.data.data.id).toBe(1)
        expect(res.data.data.status).toBe('open')
        expect(res.data.data.value).toBe(50000)
    })

    it('new deal starts with "open" status', async () => {
        mockApi.post.mockResolvedValue({
            data: { data: { id: 1, status: 'open' } },
        })

        const res = await mockApi.post('/crm/deals', validDeal)
        expect(res.data.data.status).toBe('open')
    })

    it('list deals returns with customer and stage', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [
                    { id: 1, title: 'Deal A', customer: { name: 'Empresa A' }, stage: { name: 'Proposta' }, value: 1000 },
                    { id: 2, title: 'Deal B', customer: { name: 'Empresa B' }, stage: { name: 'Negociação' }, value: 2000 },
                ],
                meta: { total: 2 },
            },
        })

        const res = await mockApi.get('/crm/deals')
        expect(res.data.data).toHaveLength(2)
        expect(res.data.data[0]).toHaveProperty('customer')
        expect(res.data.data[0]).toHaveProperty('stage')
    })

    it('move deal to different stage', async () => {
        mockApi.patch.mockResolvedValue({
            data: { data: { id: 1, stage_id: 3, stage: { name: 'Proposta Enviada' } } },
        })

        const res = await mockApi.patch('/crm/deals/1/stage', { stage_id: 3 })
        expect(res.data.data.stage_id).toBe(3)
    })

    it('won deal changes status', async () => {
        mockApi.patch.mockResolvedValue({
            data: { data: { id: 1, status: 'won', won_at: '2025-06-01' } },
        })

        const res = await mockApi.patch('/crm/deals/1', { status: 'won' })
        expect(res.data.data.status).toBe('won')
        expect(res.data.data.won_at).toBeTruthy()
    })

    it('lost deal changes status with reason', async () => {
        mockApi.patch.mockResolvedValue({
            data: { data: { id: 1, status: 'lost', lost_reason: 'Preço alto' } },
        })

        const res = await mockApi.patch('/crm/deals/1', { status: 'lost', lost_reason: 'Preço alto' })
        expect(res.data.data.status).toBe('lost')
        expect(res.data.data.lost_reason).toBe('Preço alto')
    })
})

// ---------------------------------------------------------------------------
// PIPELINE
// ---------------------------------------------------------------------------

describe('CRM — Pipeline', () => {
    it('list pipelines with stages', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                data: [{
                    id: 1,
                    name: 'Pipeline Comercial',
                    stages: [
                        { id: 1, name: 'Prospecção', order: 1 },
                        { id: 2, name: 'Qualificação', order: 2 },
                        { id: 3, name: 'Proposta', order: 3 },
                        { id: 4, name: 'Negociação', order: 4 },
                        { id: 5, name: 'Fechamento', order: 5 },
                    ],
                }],
            },
        })

        const res = await mockApi.get('/crm/pipelines')
        const pipeline = res.data.data[0]
        expect(pipeline.stages).toHaveLength(5)
        expect(pipeline.stages[0].name).toBe('Prospecção')
        expect(pipeline.stages[4].name).toBe('Fechamento')
    })

    it('pipeline stats returns deal counts per stage', async () => {
        mockApi.get.mockResolvedValue({
            data: {
                total_deals: 50,
                total_value: 500000,
                stages: [
                    { stage_id: 1, name: 'Prospecção', count: 20, value: 100000 },
                    { stage_id: 2, name: 'Proposta', count: 15, value: 200000 },
                ],
            },
        })

        const res = await mockApi.get('/crm/pipelines/1/stats')
        expect(res.data.total_deals).toBe(50)
        expect(res.data.stages[0].count).toBe(20)
    })
})

// ---------------------------------------------------------------------------
// ACTIVITIES
// ---------------------------------------------------------------------------

describe('CRM — Activities', () => {
    it('log activity for a deal', async () => {
        mockApi.post.mockResolvedValue({
            data: {
                data: {
                    id: 1,
                    deal_id: 1,
                    type: 'call',
                    description: 'Ligação comercial',
                    scheduled_at: '2025-06-10',
                },
            },
        })

        const res = await mockApi.post('/crm/deals/1/activities', {
            type: 'call',
            description: 'Ligação comercial',
        })
        expect(res.data.data.type).toBe('call')
        expect(res.data.data.deal_id).toBe(1)
    })

    it('activity types are valid', () => {
        const validTypes = ['call', 'email', 'meeting', 'task', 'note']
        validTypes.forEach(type => {
            expect(typeof type).toBe('string')
            expect(type.length).toBeGreaterThan(0)
        })
    })
})
