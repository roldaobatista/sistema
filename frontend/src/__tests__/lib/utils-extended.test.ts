import { describe, it, expect } from 'vitest'
import { cn, formatCurrency } from '@/lib/utils'

/**
 * Extended tests for utils — edge cases, boundary values, locale formats
 */
describe('cn — edge cases', () => {
    it('handles empty strings', () => {
        expect(cn('', '')).toBe('')
    })

    it('handles undefined values', () => {
        expect(cn(undefined, 'foo')).toBe('foo')
    })

    it('handles null values', () => {
        expect(cn(null, 'bar')).toBe('bar')
    })

    it('handles boolean false', () => {
        expect(cn(false && 'hidden', 'visible')).toBe('visible')
    })

    it('handles boolean true', () => {
        const result = cn(true && 'active', 'base')
        expect(result).toContain('active')
        expect(result).toContain('base')
    })

    it('merges conflicting tailwind padding', () => {
        const result = cn('p-2', 'p-4')
        expect(result).toBe('p-4')
    })

    it('merges conflicting tailwind margin', () => {
        const result = cn('m-0', 'm-8')
        expect(result).toBe('m-8')
    })

    it('merges conflicting tailwind text color', () => {
        const result = cn('text-red-500', 'text-blue-500')
        expect(result).toBe('text-blue-500')
    })

    it('merges conflicting tailwind bg color', () => {
        const result = cn('bg-white', 'bg-black')
        expect(result).toBe('bg-black')
    })

    it('preserves non-conflicting classes', () => {
        const result = cn('p-2', 'rounded-md', 'text-sm')
        expect(result).toContain('p-2')
        expect(result).toContain('rounded-md')
        expect(result).toContain('text-sm')
    })

    it('handles array of classes', () => {
        expect(cn(['a', 'b'])).toContain('a')
    })

    it('handles deeply nested conditionals', () => {
        const isActive = true
        const isDisabled = false
        const result = cn(
            'base',
            isActive && 'active',
            isDisabled && 'disabled',
            isActive && !isDisabled && 'interactive'
        )
        expect(result).toContain('active')
        expect(result).toContain('interactive')
        expect(result).not.toContain('disabled')
    })
})

describe('formatCurrency — edge cases', () => {
    it('formats zero', () => {
        expect(formatCurrency(0)).toContain('0,00')
    })

    it('formats negative values', () => {
        const result = formatCurrency(-100)
        expect(result).toContain('100,00')
    })

    it('formats large numbers with thousands separator', () => {
        const result = formatCurrency(1000000)
        expect(result).toContain('1.000.000,00')
    })

    it('formats decimal values', () => {
        expect(formatCurrency(99.99)).toContain('99,99')
    })

    it('formats single digit cents', () => {
        expect(formatCurrency(10.5)).toContain('10,50')
    })

    it('includes R$ symbol', () => {
        expect(formatCurrency(1)).toContain('R$')
    })

    it('formats very small values', () => {
        expect(formatCurrency(0.01)).toContain('0,01')
    })

    it('formats very large values', () => {
        const result = formatCurrency(999999999.99)
        expect(result).toContain('999.999.999,99')
    })

    it('handles NaN gracefully', () => {
        const result = formatCurrency(NaN)
        expect(result).toBeTruthy() // should not throw
    })

    it('formats 1234.56 correctly', () => {
        const result = formatCurrency(1234.56)
        expect(result).toContain('1.234,56')
    })
})
