import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCnpjLookup } from '@/hooks/useCnpjLookup'

const mockGet = vi.fn()
vi.mock('@/lib/api', () => ({
    default: { get: (...args: unknown[]) => mockGet(...args) },
}))

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}))

describe('useCnpjLookup', () => {
    beforeEach(() => vi.clearAllMocks())

    it('starts with loading=false', () => {
        const { result } = renderHook(() => useCnpjLookup())
        expect(result.current.loading).toBe(false)
    })

    it('returns lookup function', () => {
        const { result } = renderHook(() => useCnpjLookup())
        expect(typeof result.current.lookup).toBe('function')
    })

    it('returns null for cnpj shorter than 14 digits', async () => {
        const { result } = renderHook(() => useCnpjLookup())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('12345')
        })
        expect(response).toBeNull()
        expect(mockGet).not.toHaveBeenCalled()
    })

    it('returns null for cnpj longer than 14 digits', async () => {
        const { result } = renderHook(() => useCnpjLookup())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('123456789012345')
        })
        expect(response).toBeNull()
    })

    it('strips non-digit characters', async () => {
        mockGet.mockResolvedValueOnce({
            data: {
                name: 'Empresa', trade_name: '', email: '', phone: '',
                address_zip: '', address_street: '', address_number: '',
                address_complement: '', address_neighborhood: '', address_city: '',
                address_state: '', status: '', main_activity: '', company_size: ''
            }
        })
        const { result } = renderHook(() => useCnpjLookup())
        await act(async () => {
            await result.current.lookup('12.345.678/0001-90')
        })
        expect(mockGet).toHaveBeenCalledWith('/external/cnpj/12345678000190')
    })

    it('returns correct data on API success', async () => {
        const apiData = {
            name: 'Empresa Teste',
            trade_name: 'E. Teste',
            email: 'e@test.com',
            phone: '11999999999',
            address_zip: '01001000',
            address_street: 'Rua X',
            address_number: '100',
            address_complement: 'Sala 1',
            address_neighborhood: 'Centro',
            address_city: 'São Paulo',
            address_state: 'SP',
            status: 'ATIVA',
            main_activity: 'Comércio',
            company_size: 'ME',
        }
        mockGet.mockResolvedValueOnce({ data: apiData })
        const { result } = renderHook(() => useCnpjLookup())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('12345678000190')
        })
        expect(response).toEqual(apiData)
    })

    it('returns null on API error', async () => {
        mockGet.mockRejectedValueOnce(new Error('Fail'))
        const { result } = renderHook(() => useCnpjLookup())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('12345678000190')
        })
        expect(response).toBeNull()
    })

    it('handles null fields with defaults', async () => {
        mockGet.mockResolvedValueOnce({
            data: {
                name: null, trade_name: null, email: null, phone: null,
                address_zip: null, address_street: null, address_number: null,
                address_complement: null, address_neighborhood: null, address_city: null,
                address_state: null, status: null, main_activity: null, company_size: null
            }
        })
        const { result } = renderHook(() => useCnpjLookup())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('12345678000190')
        })
        const res = response as Record<string, string>
        expect(res.name).toBe('')
        expect(res.email).toBe('')
        expect(res.address_city).toBe('')
    })

    it('returns null for empty string', async () => {
        const { result } = renderHook(() => useCnpjLookup())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('')
        })
        expect(response).toBeNull()
    })

    it('returns all 14 fields', async () => {
        mockGet.mockResolvedValueOnce({
            data: {
                name: 'A', trade_name: 'B', email: 'c', phone: 'd',
                address_zip: 'e', address_street: 'f', address_number: 'g',
                address_complement: 'h', address_neighborhood: 'i', address_city: 'j',
                address_state: 'k', status: 'l', main_activity: 'm', company_size: 'n'
            }
        })
        const { result } = renderHook(() => useCnpjLookup())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('12345678000190')
        })
        expect(Object.keys(response as object)).toHaveLength(14)
    })
})
