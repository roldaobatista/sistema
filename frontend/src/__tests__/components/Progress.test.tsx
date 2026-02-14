import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Progress } from '@/components/ui/progress'

describe('Progress', () => {
    it('renders without crashing', () => {
        render(<Progress value={0} />)
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('has value 0 — indicator fully hidden', () => {
        const { container } = render(<Progress value={0} />)
        const indicator = container.querySelector('.bg-primary') as HTMLElement
        expect(indicator?.style.transform).toBe('translateX(-100%)')
    })

    it('has value 50 — indicator half visible', () => {
        const { container } = render(<Progress value={50} />)
        const indicator = container.querySelector('.bg-primary') as HTMLElement
        expect(indicator?.style.transform).toBe('translateX(-50%)')
    })

    it('has value 100 — indicator fully shown', () => {
        const { container } = render(<Progress value={100} />)
        const indicator = container.querySelector('.bg-primary') as HTMLElement
        expect(indicator?.style.transform).toBe('translateX(-0%)')
    })

    it('merges custom className', () => {
        render(<Progress value={0} className="my-progress" />)
        expect(screen.getByRole('progressbar').className).toContain('my-progress')
    })

    it('has correct display name', () => {
        expect(Progress.displayName).toBeDefined()
    })

    it('renders indicator element', () => {
        const { container } = render(<Progress value={50} />)
        const indicator = container.querySelector('.bg-primary')
        expect(indicator).toBeInTheDocument()
    })

    it('indicator translates based on value', () => {
        const { container } = render(<Progress value={75} />)
        const indicator = container.querySelector('.bg-primary') as HTMLElement
        expect(indicator?.style.transform).toBe('translateX(-25%)')
    })

    it('indicator at 0 is fully hidden', () => {
        const { container } = render(<Progress value={0} />)
        const indicator = container.querySelector('.bg-primary') as HTMLElement
        expect(indicator?.style.transform).toBe('translateX(-100%)')
    })

    it('indicator at 100 is fully shown', () => {
        const { container } = render(<Progress value={100} />)
        const indicator = container.querySelector('.bg-primary') as HTMLElement
        expect(indicator?.style.transform).toBe('translateX(-0%)')
    })
})
