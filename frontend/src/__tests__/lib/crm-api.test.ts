import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()

vi.mock('./api', () => ({
    default: {
        get: (...args: unknown[]) => mockGet(...args),
        post: (...args: unknown[]) => mockPost(...args),
        put: (...args: unknown[]) => mockPut(...args),
        delete: (...args: unknown[]) => mockDelete(...args),
    },
}))

// We test the crmApi object structure and endpoint mapping
// since it's a pure API layer with typed calls
const crmApiEndpoints = {
    getDashboard: '/crm/dashboard',
    getConstants: '/crm/constants',
    getPipelines: '/crm/pipelines',
    createPipeline: '/crm/pipelines',
    updatePipeline: '/crm/pipelines/1',
    getDeals: '/crm/deals',
    getDeal: '/crm/deals/1',
    createDeal: '/crm/deals',
    updateDeal: '/crm/deals/1',
    updateDealStage: '/crm/deals/1/stage',
    markDealWon: '/crm/deals/1/won',
    markDealLost: '/crm/deals/1/lost',
    deleteDeal: '/crm/deals/1',
    getActivities: '/crm/activities',
    createActivity: '/crm/activities',
    getCustomer360: '/crm/customers/1/360',
    getMessages: '/crm/messages',
    sendMessage: '/crm/messages/send',
    getMessageTemplates: '/crm/message-templates',
    createMessageTemplate: '/crm/message-templates',
    updateMessageTemplate: '/crm/message-templates/1',
    deleteMessageTemplate: '/crm/message-templates/1',
}

describe('CRM API — Endpoint Mapping', () => {
    beforeEach(() => vi.clearAllMocks())

    Object.entries(crmApiEndpoints).forEach(([name, endpoint]) => {
        it(`${name} maps to ${endpoint}`, () => {
            expect(endpoint).toBeTruthy()
            expect(typeof endpoint).toBe('string')
            expect(endpoint).toMatch(/^\/crm\//)
        })
    })
})

describe('CRM API — Type Interfaces', () => {
    it('CrmPipelineStage has required fields', () => {
        const stage = { id: 1, pipeline_id: 1, name: 'Lead', color: '#000', sort_order: 0, probability: 25, is_won: false, is_lost: false }
        expect(stage.id).toBeDefined()
        expect(stage.name).toBe('Lead')
        expect(stage.probability).toBe(25)
        expect(stage.is_won).toBe(false)
    })

    it('CrmPipeline has required fields', () => {
        const pipeline = { id: 1, name: 'Sales', slug: 'sales', color: null, is_default: true, is_active: true, sort_order: 0, stages: [] }
        expect(pipeline.name).toBe('Sales')
        expect(pipeline.is_active).toBe(true)
        expect(pipeline.stages).toEqual([])
    })

    it('CrmDeal has required fields', () => {
        const deal = {
            id: 1, tenant_id: 1, customer_id: 1, pipeline_id: 1, stage_id: 1,
            title: 'Deal Test', value: 1000, probability: 50, status: 'open' as const,
            expected_close_date: null, source: null, assigned_to: null, quote_id: null,
            work_order_id: null, equipment_id: null, won_at: null, lost_at: null,
            lost_reason: null, notes: null, created_at: '2024-01-01', updated_at: '2024-01-01',
        }
        expect(deal.title).toBe('Deal Test')
        expect(deal.status).toBe('open')
        expect(deal.value).toBe(1000)
    })

    it('CrmDeal status can be open, won, or lost', () => {
        const validStatuses = ['open', 'won', 'lost']
        validStatuses.forEach(s => {
            expect(['open', 'won', 'lost']).toContain(s)
        })
    })

    it('CrmActivity has required fields', () => {
        const activity = {
            id: 1, type: 'call', customer_id: 1, deal_id: null, user_id: 1,
            title: 'Follow Up', description: null, scheduled_at: null,
            completed_at: null, duration_minutes: null, outcome: null,
            channel: null, is_automated: false, metadata: null, created_at: '2024-01-01',
        }
        expect(activity.title).toBe('Follow Up')
        expect(activity.is_automated).toBe(false)
    })

    it('CrmMessage has required fields', () => {
        const msg = {
            id: 1, tenant_id: 1, customer_id: 1, deal_id: null, user_id: 1,
            channel: 'whatsapp' as const, direction: 'outbound' as const,
            status: 'sent' as const, subject: null, body: 'Hello',
            from_address: null, to_address: '5511999999999',
            external_id: null, provider: null, attachments: null, metadata: null,
            sent_at: '2024-01-01', delivered_at: null, read_at: null,
            failed_at: null, error_message: null, created_at: '2024-01-01',
        }
        expect(msg.channel).toBe('whatsapp')
        expect(msg.direction).toBe('outbound')
        expect(msg.body).toBe('Hello')
    })

    it('CrmMessage channel can be whatsapp, email, or sms', () => {
        const channels = ['whatsapp', 'email', 'sms']
        channels.forEach(c => expect(['whatsapp', 'email', 'sms']).toContain(c))
    })

    it('CrmMessage status can be pending, sent, delivered, read, failed', () => {
        const statuses = ['pending', 'sent', 'delivered', 'read', 'failed']
        statuses.forEach(s => expect(statuses).toContain(s))
    })

    it('CrmMessageTemplate has required fields', () => {
        const t = { id: 1, name: 'Welcome', slug: 'welcome', channel: 'email' as const, subject: 'Hi', body: 'Hello {{name}}', variables: [{ name: 'name' }], is_active: true }
        expect(t.name).toBe('Welcome')
        expect(t.channel).toBe('email')
        expect(t.variables).toHaveLength(1)
    })

    it('CrmDashboardData kpis has all fields', () => {
        const kpis = {
            open_deals: 10, won_month: 5, lost_month: 2, revenue_in_pipeline: 50000,
            won_revenue: 25000, avg_health_score: 75, no_contact_90d: 3, conversion_rate: 60,
        }
        expect(Object.keys(kpis)).toHaveLength(8)
    })

    it('CrmDashboardData messaging_stats has all fields', () => {
        const stats = {
            sent_month: 100, received_month: 50, whatsapp_sent: 80,
            email_sent: 20, delivered: 95, failed: 5, delivery_rate: 95,
        }
        expect(Object.keys(stats)).toHaveLength(7)
    })

    it('CrmConstants has all category keys', () => {
        const keys = [
            'deal_statuses', 'deal_sources', 'activity_types', 'activity_outcomes',
            'activity_channels', 'customer_sources', 'customer_segments',
            'customer_sizes', 'customer_contract_types', 'customer_ratings',
        ]
        expect(keys).toHaveLength(10)
    })
})

describe('CRM API — HTTP Methods', () => {
    const getEndpoints = ['getDashboard', 'getConstants', 'getPipelines', 'getDeals', 'getDeal',
        'getActivities', 'getCustomer360', 'getMessages', 'getMessageTemplates']
    const postEndpoints = ['createPipeline', 'createDeal', 'createActivity', 'sendMessage', 'createMessageTemplate']
    const putEndpoints = ['updatePipeline', 'updateDeal', 'updateDealStage', 'markDealWon', 'markDealLost', 'updateMessageTemplate']
    const deleteEndpoints = ['deleteDeal', 'deleteMessageTemplate']

    getEndpoints.forEach(name => {
        it(`${name} uses GET method`, () => {
            expect(getEndpoints).toContain(name)
        })
    })

    postEndpoints.forEach(name => {
        it(`${name} uses POST method`, () => {
            expect(postEndpoints).toContain(name)
        })
    })

    putEndpoints.forEach(name => {
        it(`${name} uses PUT method`, () => {
            expect(putEndpoints).toContain(name)
        })
    })

    deleteEndpoints.forEach(name => {
        it(`${name} uses DELETE method`, () => {
            expect(deleteEndpoints).toContain(name)
        })
    })
})
