import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Separator } from '@/components/ui/separator'

describe('Separator', () => {
    it('renders without crashing', () => {
        const { container } = render(<Separator />)
        expect(container.querySelector('[data-orientation]')).toBeInTheDocument()
    })

    it('renders horizontal by default', () => {
        const { container } = render(<Separator />)
        expect(container.querySelector('[data-orientation="horizontal"]')).toBeInTheDocument()
    })

    it('renders vertical orientation', () => {
        const { container } = render(<Separator orientation="vertical" />)
        expect(container.querySelector('[data-orientation="vertical"]')).toBeInTheDocument()
    })

    it('merges custom className', () => {
        const { container } = render(<Separator className="my-sep" />)
        const el = container.querySelector('[data-orientation]') as HTMLElement
        expect(el.className).toContain('my-sep')
    })

    it('has correct display name', () => {
        expect(Separator.displayName).toBeDefined()
    })

    it('is decorative by default', () => {
        const { container } = render(<Separator />)
        expect(container.querySelector('[role="none"]')).toBeInTheDocument()
    })

    it('has bg-border class', () => {
        const { container } = render(<Separator />)
        const el = container.querySelector('[data-orientation]') as HTMLElement
        expect(el.className).toContain('bg-border')
    })

    it('horizontal has full width', () => {
        const { container } = render(<Separator />)
        const el = container.querySelector('[data-orientation="horizontal"]') as HTMLElement
        expect(el.className).toContain('w-full')
    })
})
