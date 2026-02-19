import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
    it('renders with children text', () => {
        render(<Button>Click me</Button>)
        expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
    })

    it('renders as primary variant by default', () => {
        render(<Button>Primary</Button>)
        const btn = screen.getByRole('button')
        expect(btn.className).toMatch(/prix-gradient|text-white/)
    })

    it('renders secondary variant', () => {
        render(<Button variant="secondary">Sec</Button>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('bg-prix-500')
    })

    it('renders danger variant', () => {
        render(<Button variant="danger">Danger</Button>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('bg-cta-500')
    })

    it('renders outline variant', () => {
        render(<Button variant="outline">Outline</Button>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('border')
        expect(btn.className).toContain('bg-white')
    })

    it('renders ghost variant', () => {
        render(<Button variant="ghost">Ghost</Button>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('text-surface-600')
    })

    it('applies sm size class', () => {
        render(<Button size="sm">Sm</Button>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('h-8')
    })

    it('applies lg size class', () => {
        render(<Button size="lg">Lg</Button>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('h-10')
    })

    it('applies icon size class', () => {
        render(<Button size="icon">I</Button>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('h-9')
        expect(btn.className).toContain('w-9')
    })

    it('fires onClick handler', () => {
        const handler = vi.fn()
        render(<Button onClick={handler}>Click</Button>)
        fireEvent.click(screen.getByRole('button'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('is disabled when disabled prop is set', () => {
        render(<Button disabled>Disabled</Button>)
        expect(screen.getByRole('button')).toBeDisabled()
    })

    it('is disabled when loading is true', () => {
        render(<Button loading>Loading</Button>)
        expect(screen.getByRole('button')).toBeDisabled()
    })

    it('shows spinner icon when loading', () => {
        render(<Button loading>Saving</Button>)
        const btn = screen.getByRole('button')
        const spinner = btn.querySelector('.animate-spin')
        expect(spinner).toBeTruthy()
    })

    it('does not fire onClick when disabled', () => {
        const handler = vi.fn()
        render(<Button disabled onClick={handler}>Click</Button>)
        fireEvent.click(screen.getByRole('button'))
        expect(handler).not.toHaveBeenCalled()
    })

    it('merges custom className', () => {
        render(<Button className="my-custom-class">Custom</Button>)
        expect(screen.getByRole('button').className).toContain('my-custom-class')
    })
})
