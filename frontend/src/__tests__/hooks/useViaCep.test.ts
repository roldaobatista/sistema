import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViaCep } from '@/hooks/useViaCep'

const mockGet = vi.fn()
vi.mock('@/lib/api', () => ({
    default: { get: (...args: unknown[]) => mockGet(...args) },
}))

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}))

describe('useViaCep', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('starts with loading=false', () => {
        const { result } = renderHook(() => useViaCep())
        expect(result.current.loading).toBe(false)
    })

    it('returns lookup function', () => {
        const { result } = renderHook(() => useViaCep())
        expect(typeof result.current.lookup).toBe('function')
    })

    it('returns null for cep shorter than 8 digits', async () => {
        const { result } = renderHook(() => useViaCep())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('1234')
        })
        expect(response).toBeNull()
        expect(mockGet).not.toHaveBeenCalled()
    })

    it('returns null for cep longer than 8 digits', async () => {
        const { result } = renderHook(() => useViaCep())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('123456789')
        })
        expect(response).toBeNull()
    })

    it('strips non-digit characters from cep', async () => {
        mockGet.mockResolvedValueOnce({ data: { street: 'Rua A', neighborhood: 'Centro', city: 'SP', state: 'SP', complement: '' } })
        const { result } = renderHook(() => useViaCep())
        await act(async () => {
            await result.current.lookup('01001-000')
        })
        expect(mockGet).toHaveBeenCalledWith('/external/cep/01001000')
    })

    it('returns correct data on success', async () => {
        mockGet.mockResolvedValueOnce({
            data: { street: 'Rua X', neighborhood: 'Centro', city: 'São Paulo', state: 'SP', complement: 'Ap 1' }
        })
        const { result } = renderHook(() => useViaCep())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('01001000')
        })
        expect(response).toEqual({
            street: 'Rua X',
            neighborhood: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            complement: 'Ap 1',
        })
    })

    it('returns null on API error', async () => {
        mockGet.mockRejectedValueOnce(new Error('Network error'))
        const { result } = renderHook(() => useViaCep())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('01001000')
        })
        expect(response).toBeNull()
    })

    it('handles null fields with defaults', async () => {
        mockGet.mockResolvedValueOnce({
            data: { street: null, neighborhood: null, city: null, state: null, complement: null }
        })
        const { result } = renderHook(() => useViaCep())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('01001000')
        })
        expect(response).toEqual({ street: '', neighborhood: '', city: '', state: '', complement: '' })
    })

    it('returns null for empty string', async () => {
        const { result } = renderHook(() => useViaCep())
        let response: unknown
        await act(async () => {
            response = await result.current.lookup('')
        })
        expect(response).toBeNull()
    })
})
