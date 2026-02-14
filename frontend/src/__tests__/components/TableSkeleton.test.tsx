import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TableSkeleton } from '@/components/ui/tableskeleton'

describe('TableSkeleton', () => {
    it('renders without crashing', () => {
        const { container } = render(<TableSkeleton />)
        expect(container.firstChild).toBeInTheDocument()
    })

    it('renders default 5 rows', () => {
        const { container } = render(<TableSkeleton />)
        // 1 header + 5 rows = 6 flex divs with gap-4
        const rows = container.querySelectorAll('.flex.items-center.gap-4')
        expect(rows.length).toBe(6) // 1 header + 5 body rows
    })

    it('renders custom row count', () => {
        const { container } = render(<TableSkeleton rows={3} />)
        const rows = container.querySelectorAll('.flex.items-center.gap-4')
        expect(rows.length).toBe(4) // 1 header + 3 body rows
    })

    it('renders default 4 columns per row', () => {
        const { container } = render(<TableSkeleton rows={1} cols={4} />)
        const allSkeletons = container.querySelectorAll('.skeleton')
        expect(allSkeletons.length).toBe(8) // 4 header + 4 body
    })

    it('renders custom column count', () => {
        const { container } = render(<TableSkeleton rows={1} cols={6} />)
        const allSkeletons = container.querySelectorAll('.skeleton')
        expect(allSkeletons.length).toBe(12) // 6 header + 6 body
    })

    it('first column has flex:2', () => {
        const { container } = render(<TableSkeleton rows={1} cols={3} />)
        const skeletons = container.querySelectorAll('.skeleton')
        expect((skeletons[0] as HTMLElement).style.flex).toContain('2')
    })

    it('non-first columns have flex:1', () => {
        const { container } = render(<TableSkeleton rows={1} cols={3} />)
        const skeletons = container.querySelectorAll('.skeleton')
        expect((skeletons[1] as HTMLElement).style.flex).toContain('1')
        expect((skeletons[2] as HTMLElement).style.flex).toContain('1')
    })

    it('applies animation delay to rows', () => {
        const { container } = render(<TableSkeleton rows={2} cols={2} />)
        const bodySkeletons = Array.from(container.querySelectorAll('.skeleton')).slice(2) // skip header
        expect(bodySkeletons[0]).toHaveStyle({ animationDelay: '0ms' })
    })

    it('merges custom className', () => {
        const { container } = render(<TableSkeleton className="my-skeleton" />)
        expect(container.firstChild).toHaveClass('my-skeleton')
    })

    it('renders with rows=0', () => {
        const { container } = render(<TableSkeleton rows={0} />)
        const rows = container.querySelectorAll('.flex.items-center.gap-4')
        expect(rows.length).toBe(1) // just header
    })

    it('renders large grid', () => {
        const { container } = render(<TableSkeleton rows={10} cols={8} />)
        const allSkeletons = container.querySelectorAll('.skeleton')
        expect(allSkeletons.length).toBe(88) // 8 header + 80 body
    })
})
