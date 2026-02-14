import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from '@/components/ui/skeleton'

describe('Skeleton', () => {
    it('renders without crashing', () => {
        const { container } = render(<Skeleton />)
        expect(container.firstChild).toBeInTheDocument()
    })

    it('renders as div element', () => {
        const { container } = render(<Skeleton />)
        expect(container.firstChild?.nodeName).toBe('DIV')
    })

    it('has animate-shimmer class', () => {
        const { container } = render(<Skeleton />)
        expect((container.firstChild as HTMLElement).className).toContain('animate-shimmer')
    })

    it('has rounded-md class', () => {
        const { container } = render(<Skeleton />)
        expect((container.firstChild as HTMLElement).className).toContain('rounded-md')
    })

    it('merges custom className', () => {
        const { container } = render(<Skeleton className="h-4 w-32" />)
        expect(container.firstChild).toHaveClass('h-4')
        expect(container.firstChild).toHaveClass('w-32')
    })

    it('passes through HTML div attributes', () => {
        const { container } = render(<Skeleton data-testid="skeleton" role="status" />)
        expect(container.querySelector('[data-testid="skeleton"]')).toBeInTheDocument()
        expect(container.querySelector('[role="status"]')).toBeInTheDocument()
    })

    it('renders with fixed height', () => {
        const { container } = render(<Skeleton className="h-8" />)
        expect(container.firstChild).toHaveClass('h-8')
    })

    it('renders with fixed width', () => {
        const { container } = render(<Skeleton className="w-full" />)
        expect(container.firstChild).toHaveClass('w-full')
    })

    it('can be used for text placeholder', () => {
        const { container } = render(<Skeleton className="h-4 w-48" />)
        expect(container.firstChild).toHaveClass('h-4')
        expect(container.firstChild).toHaveClass('w-48')
    })

    it('can be used for avatar placeholder', () => {
        const { container } = render(<Skeleton className="h-10 w-10 rounded-full" />)
        expect(container.firstChild).toHaveClass('rounded-full')
    })
})
