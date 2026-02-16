import { describe, it, expect } from 'vitest'
import { cn, formatCurrency } from '@/lib/utils'

describe('cn (class name merger)', () => {
    it('should merge class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
        const shouldHide = false
        expect(cn('base', shouldHide && 'hidden', 'visible')).toBe('base visible')
    })

    it('should resolve tailwind conflicts', () => {
        const result = cn('p-4', 'p-2')
        expect(result).toBe('p-2')
    })

    it('should handle empty inputs', () => {
        expect(cn()).toBe('')
    })

    it('should handle undefined and null', () => {
        expect(cn('base', undefined, null, 'end')).toBe('base end')
    })
})

describe('formatCurrency', () => {
    it('should format positive values in BRL', () => {
        const result = formatCurrency(1234.56)
        // pt-BR format: R$ 1.234,56
        expect(result).toContain('R$')
        expect(result).toContain('1.234')
        expect(result).toContain('56')
    })

    it('should format zero', () => {
        const result = formatCurrency(0)
        expect(result).toContain('R$')
        expect(result).toContain('0,00')
    })

    it('should format negative values', () => {
        const result = formatCurrency(-500)
        expect(result).toContain('R$')
        expect(result).toContain('500')
    })

    it('should handle small decimal values', () => {
        const result = formatCurrency(0.01)
        expect(result).toContain('0,01')
    })

    it('should handle large values', () => {
        const result = formatCurrency(1000000)
        expect(result).toContain('1.000.000')
    })
})
