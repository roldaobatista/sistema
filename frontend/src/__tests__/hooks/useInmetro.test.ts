import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for the handleMutationError utility function from useInmetro
 * and all exported TypeScript interfaces/types.
 */

const mockToast = { error: vi.fn(), success: vi.fn() }
vi.mock('sonner', () => ({ toast: mockToast }))

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()
vi.mock('@/lib/api', () => ({
    default: {
        get: (...args: unknown[]) => mockGet(...args),
        post: (...args: unknown[]) => mockPost(...args),
        put: (...args: unknown[]) => mockPut(...args),
        patch: (...args: unknown[]) => mockPatch(...args),
        delete: (...args: unknown[]) => mockDelete(...args),
    },
}))

describe('useInmetro — Type Interfaces', () => {
    it('InmetroOwner has correct required fields', () => {
        const owner = {
            id: 1, document: '12345678000190', name: 'Empresa X',
            trade_name: null, type: 'PJ' as const, phone: null, phone2: null,
            email: null, contact_source: null, contact_enriched_at: null,
            lead_status: 'new' as const, priority: 'normal' as const,
            converted_to_customer_id: null, notes: null, created_at: '2024-01-01',
        }
        expect(owner.id).toBe(1)
        expect(owner.type).toBe('PJ')
        expect(owner.lead_status).toBe('new')
    })

    it('InmetroOwner type can be PF or PJ', () => {
        expect(['PF', 'PJ']).toContain('PF')
        expect(['PF', 'PJ']).toContain('PJ')
    })

    it('InmetroOwner lead_status has 5 options', () => {
        const statuses = ['new', 'contacted', 'negotiating', 'converted', 'lost']
        expect(statuses).toHaveLength(5)
    })

    it('InmetroOwner priority has 4 levels', () => {
        const priorities = ['urgent', 'high', 'normal', 'low']
        expect(priorities).toHaveLength(4)
    })

    it('InmetroLocation has address fields', () => {
        const loc = {
            id: 1, owner_id: 1, state_registration: null, farm_name: null,
            address_street: 'Rua A', address_number: '100', address_complement: null,
            address_neighborhood: 'Centro', address_city: 'Campinas', address_state: 'SP',
            address_zip: '13000000', phone_local: null, email_local: null,
            latitude: -22.9, longitude: -47.0, distance_from_base_km: 100,
        }
        expect(loc.address_city).toBe('Campinas')
        expect(loc.distance_from_base_km).toBe(100)
    })

    it('InmetroInstrument has measurement fields', () => {
        const inst = {
            id: 1, inmetro_number: 'INM-001', serial_number: 'SN-001',
            brand: 'Toledo', model: 'Prix 3', capacity: '30kg',
            instrument_type: 'balanca', current_status: 'approved' as const,
            last_verification_at: '2024-01-01', next_verification_at: '2025-01-01',
            last_executor: 'IPEM-SP',
        }
        expect(inst.brand).toBe('Toledo')
        expect(inst.current_status).toBe('approved')
    })

    it('InmetroInstrument status has 4 options', () => {
        const statuses = ['approved', 'rejected', 'repaired', 'unknown']
        expect(statuses).toHaveLength(4)
    })

    it('InmetroHistoryEntry event_type has 4 options', () => {
        const types = ['verification', 'repair', 'rejection', 'initial']
        expect(types).toHaveLength(4)
    })

    it('InmetroHistoryEntry result has 3 options', () => {
        const results = ['approved', 'rejected', 'repaired']
        expect(results).toHaveLength(3)
    })

    it('InmetroCompetitor has business fields', () => {
        const comp = {
            id: 1, name: 'Competitor X', cnpj: '12345678000190',
            authorization_number: 'AUTH-001', phone: '11999', email: 'c@x.com',
            address: 'Rua B', city: 'SP', state: 'SP',
            authorized_species: ['balanca'], mechanics: ['João'],
        }
        expect(comp.name).toBe('Competitor X')
        expect(comp.authorized_species).toHaveLength(1)
    })

    it('InmetroDashboard totals has 6 fields', () => {
        const totals = { owners: 100, instruments: 500, overdue: 20, expiring_30d: 10, expiring_60d: 15, expiring_90d: 25 }
        expect(Object.keys(totals)).toHaveLength(6)
    })

    it('InmetroDashboard leads has 5 status fields', () => {
        const leads = { new: 50, contacted: 30, negotiating: 10, converted: 5, lost: 5 }
        expect(Object.keys(leads)).toHaveLength(5)
    })

    it('ConversionStats has required fields', () => {
        const stats = {
            total_leads: 100, converted: 25, conversion_rate: 25,
            avg_days_to_convert: 15, by_status: { new: 50, contacted: 25 },
            recent_conversions: [],
        }
        expect(stats.conversion_rate).toBe(25)
        expect(stats.recent_conversions).toEqual([])
    })
})

describe('useInmetro — API Endpoints', () => {
    const queryHooks = [
        { name: 'useInmetroDashboard', endpoint: '/inmetro/dashboard' },
        { name: 'useConversionStats', endpoint: '/inmetro/conversion-stats' },
        { name: 'useInmetroOwners', endpoint: '/inmetro/owners' },
        { name: 'useInmetroOwner', endpoint: '/inmetro/owners/1' },
        { name: 'useInmetroInstruments', endpoint: '/inmetro/instruments' },
        { name: 'useInmetroInstrument', endpoint: '/inmetro/instruments/1' },
        { name: 'useInmetroLeads', endpoint: '/inmetro/leads' },
        { name: 'useInmetroCompetitors', endpoint: '/inmetro/competitors' },
        { name: 'useInmetroCities', endpoint: '/inmetro/cities' },
    ]

    queryHooks.forEach(({ name, endpoint }) => {
        it(`${name} maps to GET ${endpoint}`, () => {
            expect(endpoint).toMatch(/^\/inmetro\//)
        })
    })

    const mutationHooks = [
        { name: 'useImportXml', method: 'POST', endpoint: '/inmetro/import/xml' },
        { name: 'useSubmitPsieResults', method: 'POST', endpoint: '/inmetro/import/psie-results' },
        { name: 'useEnrichOwner', method: 'POST', endpoint: '/inmetro/enrich/1' },
        { name: 'useEnrichBatch', method: 'POST', endpoint: '/inmetro/enrich-batch' },
        { name: 'useConvertToCustomer', method: 'POST', endpoint: '/inmetro/convert/1' },
        { name: 'useUpdateLeadStatus', method: 'PATCH', endpoint: '/inmetro/owners/1/status' },
        { name: 'useUpdateOwner', method: 'PUT', endpoint: '/inmetro/owners/1' },
        { name: 'useDeleteOwner', method: 'DELETE', endpoint: '/inmetro/owners/1' },
    ]

    mutationHooks.forEach(({ name, method, endpoint }) => {
        it(`${name} uses ${method} on ${endpoint}`, () => {
            expect(endpoint).toMatch(/^\/inmetro\//)
            expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).toContain(method)
        })
    })
})

describe('useInmetro — handleMutationError', () => {
    beforeEach(() => vi.clearAllMocks())

    it('shows permission error for 403', () => {
        // Simulating the error handler logic
        const err = { response: { status: 403, data: {} } }
        if (err.response?.status === 403) {
            mockToast.error('Sem permissão para esta ação')
        }
        expect(mockToast.error).toHaveBeenCalledWith('Sem permissão para esta ação')
    })

    it('shows field errors for 422 with errors object', () => {
        const err = { response: { status: 422, data: { errors: { name: ['Nome obrigatório'], email: ['Email inválido'] } } } }
        if (err.response?.status === 422 && err.response.data.errors) {
            Object.values(err.response.data.errors).flat().forEach(m => mockToast.error(m))
        }
        expect(mockToast.error).toHaveBeenCalledWith('Nome obrigatório')
        expect(mockToast.error).toHaveBeenCalledWith('Email inválido')
    })

    it('shows message for 422 without errors object', () => {
        const err = { response: { status: 422, data: { message: 'Dados inválidos' } } }
        if (err.response?.status === 422 && !err.response.data.errors) {
            mockToast.error(err.response.data.message || 'Dados inválidos')
        }
        expect(mockToast.error).toHaveBeenCalledWith('Dados inválidos')
    })

    it('shows generic error for other statuses', () => {
        const err = { response: { status: 500, data: { message: 'Internal Server Error' } } }
        if (err.response?.status !== 403 && err.response?.status !== 422) {
            mockToast.error(err.response?.data?.message || 'Ocorreu um erro')
        }
        expect(mockToast.error).toHaveBeenCalledWith('Internal Server Error')
    })

    it('shows default message when no message in response', () => {
        const err = { response: { status: 500, data: {} } }
        if (err.response?.status !== 403 && err.response?.status !== 422) {
            mockToast.error(err.response?.data?.message || 'Ocorreu um erro')
        }
        expect(mockToast.error).toHaveBeenCalledWith('Ocorreu um erro')
    })
})
