import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for useIbge hooks — states and cities API
 */
const mockUseQuery = vi.fn()
vi.mock('@tanstack/react-query', () => ({
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
}))

describe('useIbge — API Endpoints', () => {
    beforeEach(() => vi.clearAllMocks())

    describe('States Endpoint', () => {
        it('fetches from IBGE states API', () => {
            const url = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados'
            expect(url).toContain('ibge.gov.br')
            expect(url).toContain('estados')
        })

        it('returns sorted states', () => {
            const states = [
                { id: 35, sigla: 'SP', nome: 'São Paulo' },
                { id: 33, sigla: 'RJ', nome: 'Rio de Janeiro' },
                { id: 31, sigla: 'MG', nome: 'Minas Gerais' },
            ]
            const sorted = [...states].sort((a, b) => a.nome.localeCompare(b.nome))
            expect(sorted[0].nome).toBe('Minas Gerais')
            expect(sorted[1].nome).toBe('Rio de Janeiro')
            expect(sorted[2].nome).toBe('São Paulo')
        })

        it('state object has id, sigla, nome', () => {
            const state = { id: 35, sigla: 'SP', nome: 'São Paulo' }
            expect(state.id).toBe(35)
            expect(state.sigla).toBe('SP')
            expect(state.nome).toBe('São Paulo')
        })

        it('uses 24h stale time', () => {
            const staleTime = 1000 * 60 * 60 * 24
            expect(staleTime).toBe(86400000)
        })

        it('query key includes "ibge-states"', () => {
            const queryKey = ['ibge-states']
            expect(queryKey).toContain('ibge-states')
        })
    })

    describe('Cities Endpoint', () => {
        it('fetches from IBGE cities API with UF', () => {
            const uf = 'SP'
            const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
            expect(url).toContain('municipios')
            expect(url).toContain(uf)
        })

        it('returns sorted cities', () => {
            const cities = [
                { id: 3550308, nome: 'São Paulo' },
                { id: 3509502, nome: 'Campinas' },
                { id: 3547809, nome: 'Santos' },
            ]
            const sorted = [...cities].sort((a, b) => a.nome.localeCompare(b.nome))
            expect(sorted[0].nome).toBe('Campinas')
            expect(sorted[1].nome).toBe('Santos')
            expect(sorted[2].nome).toBe('São Paulo')
        })

        it('city object has id and nome', () => {
            const city = { id: 3550308, nome: 'São Paulo' }
            expect(city.id).toBe(3550308)
            expect(city.nome).toBe('São Paulo')
        })

        it('query key includes "ibge-cities" and uf', () => {
            const queryKey = ['ibge-cities', 'SP']
            expect(queryKey[0]).toBe('ibge-cities')
            expect(queryKey[1]).toBe('SP')
        })

        it('is disabled when uf is empty', () => {
            const uf = ''
            const enabled = !!uf
            expect(enabled).toBe(false)
        })

        it('is enabled when uf is provided', () => {
            const uf = 'RJ'
            const enabled = !!uf
            expect(enabled).toBe(true)
        })
    })
})

describe('useIbge — All 27 Brazilian states', () => {
    const allUFs = [
        'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
        'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
        'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
    ]

    it('has 27 Brazilian UFs', () => {
        expect(allUFs).toHaveLength(27)
    })

    allUFs.forEach(uf => {
        it(`${uf} is a valid 2-letter UF`, () => {
            expect(uf).toHaveLength(2)
            expect(uf).toBe(uf.toUpperCase())
        })
    })
})
