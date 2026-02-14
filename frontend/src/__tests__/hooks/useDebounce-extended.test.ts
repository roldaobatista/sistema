import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '@/hooks/useDebounce'

/**
 * Extended useDebounce tests — rapid changes, type safety, edge cases
 */
describe('useDebounce — Extended Tests', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('debounces with custom delay of 100ms', () => {
        const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
            initialProps: { value: 'a', delay: 100 },
        })
        expect(result.current).toBe('a')

        rerender({ value: 'b', delay: 100 })
        expect(result.current).toBe('a') // not yet

        act(() => { vi.advanceTimersByTime(100) })
        expect(result.current).toBe('b')
    })

    it('debounces with long delay of 1000ms', () => {
        const { result, rerender } = renderHook(({ value }) => useDebounce(value, 1000), {
            initialProps: { value: 'start' },
        })

        rerender({ value: 'end' })
        act(() => { vi.advanceTimersByTime(500) })
        expect(result.current).toBe('start') // still waiting

        act(() => { vi.advanceTimersByTime(500) })
        expect(result.current).toBe('end')
    })

    it('debounces number values', () => {
        const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
            initialProps: { value: 0 },
        })

        rerender({ value: 42 })
        act(() => { vi.advanceTimersByTime(300) })
        expect(result.current).toBe(42)
    })

    it('debounces boolean values', () => {
        const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
            initialProps: { value: false },
        })

        rerender({ value: true })
        act(() => { vi.advanceTimersByTime(300) })
        expect(result.current).toBe(true)
    })

    it('debounces null values', () => {
        const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
            initialProps: { value: 'hello' as string | null },
        })

        rerender({ value: null })
        act(() => { vi.advanceTimersByTime(300) })
        expect(result.current).toBeNull()
    })

    it('handles rapid sequential changes — only last value used', () => {
        const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
            initialProps: { value: 'a' },
        })

        rerender({ value: 'b' })
        act(() => { vi.advanceTimersByTime(100) })
        rerender({ value: 'c' })
        act(() => { vi.advanceTimersByTime(100) })
        rerender({ value: 'd' })
        act(() => { vi.advanceTimersByTime(100) })
        rerender({ value: 'e' })
        act(() => { vi.advanceTimersByTime(300) })

        expect(result.current).toBe('e')
    })

    it('handles delay of 0', () => {
        const { result, rerender } = renderHook(({ value }) => useDebounce(value, 0), {
            initialProps: { value: 'a' },
        })

        rerender({ value: 'b' })
        act(() => { vi.advanceTimersByTime(0) })
        expect(result.current).toBe('b')
    })

    it('handles same value re-render', () => {
        const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
            initialProps: { value: 'same' },
        })

        rerender({ value: 'same' })
        act(() => { vi.advanceTimersByTime(300) })
        expect(result.current).toBe('same')
    })

    it('debounces object values', () => {
        const obj1 = { name: 'A' }
        const obj2 = { name: 'B' }
        const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
            initialProps: { value: obj1 },
        })

        rerender({ value: obj2 })
        act(() => { vi.advanceTimersByTime(300) })
        expect(result.current).toEqual({ name: 'B' })
    })

    it('debounces empty string', () => {
        const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
            initialProps: { value: 'text' },
        })

        rerender({ value: '' })
        act(() => { vi.advanceTimersByTime(300) })
        expect(result.current).toBe('')
    })
})
