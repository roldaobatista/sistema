import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToleranceBar } from '@/components/ui/tolerancebar'

describe('ToleranceBar', () => {
    it('renders without crashing', () => {
        render(<ToleranceBar />)
        expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('has aria-label for accessibility', () => {
        render(<ToleranceBar />)
        expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Indicador de tolerância')
    })

    it('renders three segments', () => {
        const { container } = render(<ToleranceBar />)
        const bar = container.querySelector('[role="img"]')!
        expect(bar.children).toHaveLength(3)
    })

    it('uses default proportions 0.6/0.2/0.2', () => {
        const { container } = render(<ToleranceBar />)
        const segments = container.querySelector('[role="img"]')!.children
        expect((segments[0] as HTMLElement).style.flex).toContain('0.6')
        expect((segments[1] as HTMLElement).style.flex).toContain('0.2')
        expect((segments[2] as HTMLElement).style.flex).toContain('0.2')
    })

    it('uses custom proportions', () => {
        const { container } = render(<ToleranceBar ok={0.5} warn={0.3} critical={0.2} />)
        const segments = container.querySelector('[role="img"]')!.children
        expect((segments[0] as HTMLElement).style.flex).toContain('0.5')
        expect((segments[1] as HTMLElement).style.flex).toContain('0.3')
        expect((segments[2] as HTMLElement).style.flex).toContain('0.2')
    })

    it('applies xs size', () => {
        const { container } = render(<ToleranceBar size="xs" />)
        const first = container.querySelector('[role="img"]')!.children[0]
        expect((first as HTMLElement).className).toContain('h-0.5')
    })

    it('applies sm size (default)', () => {
        const { container } = render(<ToleranceBar />)
        const first = container.querySelector('[role="img"]')!.children[0]
        expect((first as HTMLElement).className).toContain('h-1')
    })

    it('applies md size', () => {
        const { container } = render(<ToleranceBar size="md" />)
        const first = container.querySelector('[role="img"]')!.children[0]
        expect((first as HTMLElement).className).toContain('h-1.5')
    })

    it('first segment has rounded-l-full', () => {
        const { container } = render(<ToleranceBar />)
        const first = container.querySelector('[role="img"]')!.children[0]
        expect((first as HTMLElement).className).toContain('rounded-l-full')
    })

    it('last segment has rounded-r-full', () => {
        const { container } = render(<ToleranceBar />)
        const last = container.querySelector('[role="img"]')!.children[2]
        expect((last as HTMLElement).className).toContain('rounded-r-full')
    })

    it('first segment is green (emerald)', () => {
        const { container } = render(<ToleranceBar />)
        const first = container.querySelector('[role="img"]')!.children[0]
        expect((first as HTMLElement).className).toContain('bg-emerald')
    })

    it('second segment is amber', () => {
        const { container } = render(<ToleranceBar />)
        const middle = container.querySelector('[role="img"]')!.children[1]
        expect((middle as HTMLElement).className).toContain('bg-amber')
    })

    it('third segment is red', () => {
        const { container } = render(<ToleranceBar />)
        const last = container.querySelector('[role="img"]')!.children[2]
        expect((last as HTMLElement).className).toContain('bg-red')
    })

    it('merges custom className', () => {
        const { container } = render(<ToleranceBar className="my-bar" />)
        expect(container.querySelector('[role="img"]')).toHaveClass('my-bar')
    })
})
