import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '@/hooks/useDebounce'

describe('useDebounce', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    it('should return initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('hello', 300))
        expect(result.current).toBe('hello')
    })

    it('should debounce value changes', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 300 } }
        )

        expect(result.current).toBe('initial')

        // Change value
        rerender({ value: 'updated', delay: 300 })

        // Should still be old value before delay
        expect(result.current).toBe('initial')

        // Advance time
        act(() => { vi.advanceTimersByTime(300) })

        // Now should be updated
        expect(result.current).toBe('updated')
    })

    it('should reset timer on rapid changes', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'a', delay: 300 } }
        )

        rerender({ value: 'b', delay: 300 })
        act(() => { vi.advanceTimersByTime(100) })

        rerender({ value: 'c', delay: 300 })
        act(() => { vi.advanceTimersByTime(100) })

        rerender({ value: 'd', delay: 300 })

        // Not enough time has passed since last change
        expect(result.current).toBe('a')

        // Advance past debounce delay from last change
        act(() => { vi.advanceTimersByTime(300) })
        expect(result.current).toBe('d')
    })

    it('should use default delay of 300ms', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value),
            { initialProps: { value: 'start' } }
        )

        rerender({ value: 'end' })

        // At 299ms, still old
        act(() => { vi.advanceTimersByTime(299) })
        expect(result.current).toBe('start')

        // At 300ms, updated
        act(() => { vi.advanceTimersByTime(1) })
        expect(result.current).toBe('end')
    })

    it('should work with numeric values', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 500),
            { initialProps: { value: 0 } }
        )

        rerender({ value: 42 })
        act(() => { vi.advanceTimersByTime(500) })
        expect(result.current).toBe(42)
    })

    it('should work with custom delay', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'x', delay: 1000 } }
        )

        rerender({ value: 'y', delay: 1000 })
        act(() => { vi.advanceTimersByTime(999) })
        expect(result.current).toBe('x')

        act(() => { vi.advanceTimersByTime(1) })
        expect(result.current).toBe('y')
    })

    it('should cleanup timer on unmount', () => {
        const { unmount, rerender } = renderHook(
            ({ value }) => useDebounce(value, 300),
            { initialProps: { value: 'a' } }
        )

        rerender({ value: 'b' })

        // Unmounting should not throw
        expect(() => unmount()).not.toThrow()
    })
})
